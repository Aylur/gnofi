import GObject, {
  property,
  getter,
  setter,
  register,
  signal,
  gtype,
  type GType,
  ParamSpec,
} from "gnim/gobject"
import { addChild, removeChild } from "gnim"
import { PickerPlugin } from "./PickerPlugin"
import { PickerCollectionPlugin } from "./PickerCollectionPlugin"
import { HelpPickerPlugin } from "./HelpPickerPlugin"

type Keyname =
  | "Escape"
  | "Return"
  | "Tab"
  | "ISO_Left_Tab"
  | "BackSpace"
  | "Down"
  | "Up"
  | "Right"
  | "Left"
  | "Shift_L"
  | "Shift_R"
  | "Control_L"
  | "Control_R"
  | "n"
  | "p"

export namespace Picker {
  export interface Event<NativeEvent> {
    nativeEvent?: NativeEvent
    controlMod?: boolean
    focusedEntry: boolean
    key: number
  }

  export type FocusTarget =
    | "forward"
    | "backward"
    | "entry"
    | "up"
    | "down"
    | "right"
    | "left"

  export interface SignalSignatures<NativeEvent> extends GObject.Object.SignalSignatures {
    "notify::text": (spec: ParamSpec<string>) => void
    "notify::active-plugin": (spec: ParamSpec<PickerPlugin<unknown>>) => void
    "start-search": (event: Event<NativeEvent>) => void
    "focus": (target: FocusTarget) => void
    "close": () => void
  }

  export interface ConstructorProps extends GObject.Object.ConstructorProps {
    keys: Record<`KEY_${Keyname}`, number>
    commandLeader?: string
    visibleCommand?: boolean
  }
}

@register()
export class Picker<NativeEvent = any> extends GObject.Object {
  declare static $gtype: GType<Picker>
  declare $signals: Picker.SignalSignatures<NativeEvent>

  @property(String) commandLeader
  @property(Boolean) visibleCommand
  @property(Boolean) isOpen = false

  @getter(String) get text() {
    return this._text
  }

  @setter(String) set text(text: string) {
    if (this._text !== text) {
      this._text = text
      this.onText(text)
      this.notify("text")
    }
  }

  @getter(PickerPlugin) get activePlugin() {
    return this._activePlugin
  }

  get builtinDefaultPlugin() {
    return this._defaultPlugin
  }

  get builtinHelpPlugin() {
    return this._helpPlugin
  }

  get plugins() {
    return [...this._plugins.values()]
  }

  @signal() close() {
    this.isOpen = false
    this.text = ""
    this.activePlugin = this.dockPlugin
  }

  @signal(String) open(text: string) {
    this.isOpen = true
    this.text = text
    this.focus("entry")
  }

  @signal(Object) startSearch(event: object) {
    void event
  }

  @signal(gtype<Picker.FocusTarget>(String)) focus(target: Picker.FocusTarget): void {
    return void target
  }

  private _text = ""
  private _plugins = new Map<string, PickerPlugin<unknown>>()
  private _dockPlugin = new PickerPlugin({ command: "dock" })
  private _helpPlugin = new HelpPickerPlugin({ command: "help", picker: this })
  private _defaultPlugin = new PickerCollectionPlugin({ command: "default" })
  private _activePlugin = this._dockPlugin
  private _keys: Record<`KEY_${Keyname}`, number>

  constructor({
    commandLeader = ":",
    visibleCommand = false,
    keys,
  }: Picker.ConstructorProps) {
    super()
    this.commandLeader = commandLeader
    this.visibleCommand = visibleCommand
    this._keys = keys
  }

  connect<S extends keyof Picker.SignalSignatures<NativeEvent>>(
    signal: S,
    callback: GObject.SignalCallback<this, Picker.SignalSignatures<NativeEvent>[S]>,
  ): number {
    return super.connect(signal, callback)
  }

  private set activePlugin(plugin: PickerPlugin<any>) {
    if (this._activePlugin !== plugin) {
      this._activePlugin.clear()
      this._activePlugin = plugin
      this.notify("active-plugin")
    }
  }

  private get dockPlugin() {
    return this._plugins.get("dock") ?? this._dockPlugin
  }

  private get defaultPlugin() {
    return this._plugins.get("default") ?? this._defaultPlugin
  }

  private get helpPlugin() {
    return this._plugins.get("help") ?? this._helpPlugin
  }

  addPlugin(...plugins: PickerPlugin<unknown>[]) {
    for (const plugin of plugins) {
      if (plugin.command === "dock" && this.activePlugin === this.dockPlugin) {
        this.activePlugin = plugin
      }
      this._plugins.set(plugin.command, plugin)
    }
  }

  [addChild](child: GObject.Object, type: string | null) {
    if (!(child instanceof PickerPlugin)) {
      throw Error("Picker child not an instanceof PickerPlugin")
    }

    if (type === "default" || type === "default-only") {
      this.builtinDefaultPlugin.addPlugin(child)
    }

    if (type !== "default-only") {
      this.addPlugin(child)
    }
  }

  removePlugin(command: string) {
    this._plugins.delete(command)
  }

  [removeChild](child: GObject.Object) {
    if (child instanceof PickerPlugin) {
      this.removePlugin(child.command)
    }
  }

  private parseInput(): [string, PickerPlugin<unknown>?] {
    const { text, commandLeader, _plugins: plugins, defaultPlugin } = this

    if (text.startsWith(commandLeader)) {
      const whitespaceIndex = text.search(/\s/)
      const [cmd, args] =
        whitespaceIndex === -1
          ? [text, ""]
          : [text.slice(0, whitespaceIndex), text.slice(whitespaceIndex)]

      const command = cmd.replace(commandLeader, "")
      return [args, plugins.get(command)]
    }

    return [text, defaultPlugin]
  }

  private isDefault(plugin: PickerPlugin<unknown>) {
    return (
      plugin === this.defaultPlugin ||
      plugin === this.dockPlugin ||
      plugin === this.helpPlugin
    )
  }

  private onText(text: string) {
    // 0. command mode
    if (!this.isDefault(this.activePlugin)) {
      // in visibleCommand we go to 3. instead
      if (!this.visibleCommand) return this.activePlugin.search(text)
    }

    // 1. dock mode
    if (text === "") {
      return (this.activePlugin = this.dockPlugin).search(text)
    }

    // 2. default mode
    if (!text.startsWith(this.commandLeader)) {
      return (this.activePlugin = this.defaultPlugin).search(text)
    }

    const [txt, plugin] = this.parseInput()

    // 3. command mode
    if (plugin && !this.isDefault(plugin) && txt !== "") {
      if (!this.visibleCommand) this.text = txt.trim()
      return (this.activePlugin = plugin).search(txt)
    }

    // 4. help mode
    return (this.activePlugin = this.helpPlugin).search(text)
  }

  private onActivate(): void {
    if (this.visibleCommand) {
      const [txt, plugin] = this.parseInput()
      plugin?.activate(txt)
    } else {
      this.activePlugin.activate(this.text)
    }
  }

  private onComplete(): string | void {
    let complete: string | boolean

    if (this.visibleCommand) {
      const [txt, plugin] = this.parseInput()
      complete = plugin?.complete(txt) ?? ""
      if (typeof complete === "string" && complete) {
        return plugin ? `${this.commandLeader}${plugin.command} ${complete}` : complete
      }
    } else {
      complete = this.activePlugin.complete(this.text)
      if (typeof complete === "string" && complete) {
        return complete
      }
    }
  }

  keypress(event: Picker.Event<NativeEvent>): boolean {
    const { key, focusedEntry, controlMod } = event
    const Key = this._keys

    if (controlMod) {
      switch (key) {
        case Key.KEY_n: {
          this.focus("forward")
          return true
        }
        case Key.KEY_p: {
          this.focus("backward")
          return true
        }
      }
    }

    switch (key) {
      case Key.KEY_Escape: {
        this.close()
        return true
      }
      case Key.KEY_Return: {
        if (focusedEntry) {
          this.onActivate()
          return true
        }
        break
      }
      case Key.KEY_Tab: {
        if (focusedEntry) {
          const complete = this.onComplete()
          if (complete && this.text !== complete) {
            this.text = complete
            this.focus("entry")
            return true
          }
        }

        this.focus("forward")
        return true
      }
      case Key.KEY_ISO_Left_Tab: {
        this.focus("backward")
        return true
      }
      case Key.KEY_BackSpace: {
        if (
          focusedEntry &&
          !this.visibleCommand &&
          !this.isDefault(this.activePlugin) &&
          this.text === ""
        ) {
          const { command } = this.activePlugin
          this.activePlugin = this.dockPlugin
          this.text = `${this.commandLeader}${command}`
          this.focus("entry")
          return true
        }

        if (!focusedEntry) {
          this.text = this.text.slice(0, -1)
          this.focus("entry")
          return true
        }

        return false
      }
      case Key.KEY_Down:
        this.focus("down")
        return true
      case Key.KEY_Up:
        if (!focusedEntry) {
          this.focus("up")
          return true
        }
        break
      case Key.KEY_Right:
        if (!focusedEntry) {
          this.focus("right")
          return true
        }
        break
      case Key.KEY_Left:
        if (!focusedEntry) {
          this.focus("left")
          return true
        }
        break
      case Key.KEY_Shift_L:
      case Key.KEY_Shift_R:
      case Key.KEY_Control_L:
      case Key.KEY_Control_R: {
        break
      }
      default: {
        if (!focusedEntry) {
          this.startSearch(event)
          return true
        }
      }
    }

    return false
  }
}
