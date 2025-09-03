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
import { appendChild, removeChild } from "gnim"
import { Picker } from "./Picker"
import { PickerGroup } from "./PickerGroup"
import { HelpPicker } from "./HelpPicker"

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

// Gnome Shell extensions are not allowed to import Gdk
// so this can either be Gdk or Clutter
// even though gnome-shell itself does import Gdk?
type KeyBackend = Record<`KEY_${Keyname}`, number>

export namespace Gnofi {
  export interface Event {
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

  export interface SignalSignatures extends GObject.Object.SignalSignatures {
    "notify::text": (spec: ParamSpec<string>) => void
    "notify::active-picker": (spec: ParamSpec<Picker>) => void
    "notify::is-open": (spec: ParamSpec<boolean>) => void
    "focus": (target: FocusTarget) => void
    "close": () => void
  }

  export interface ConstructorProps extends GObject.Object.ConstructorProps {
    keys: KeyBackend
    commandLeader?: string
    visibleCommand?: boolean
  }
}

@register()
export class Gnofi extends GObject.Object {
  declare static $gtype: GType<Gnofi>
  declare $signals: Gnofi.SignalSignatures

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

  @getter(Picker) get activePicker() {
    return this._activePicker
  }

  get builtinDefaultPicker() {
    return this._defaultPicker
  }

  get builtinHelpPicker() {
    return this._helpPicker
  }

  get pickers() {
    return [...this._pickers.values()]
  }

  @signal() close() {
    this.isOpen = false
    this.text = ""
    this.activePicker = this.dockPicker
  }

  @signal(String) open(text: string) {
    this.isOpen = true
    this.text = text
    this.focus("entry")
  }

  @signal(gtype<Gnofi.FocusTarget>(String)) focus(target: Gnofi.FocusTarget): void {
    return void target
  }

  private _text = ""
  private _pickers = new Map<string, Picker>()
  private _dockPicker = new Picker({ command: "dock" })
  private _helpPicker = new HelpPicker({ command: "help", picker: this })
  private _defaultPicker = new PickerGroup({ command: "default" })
  private _activePicker = this._dockPicker
  private _keys: KeyBackend

  constructor({
    commandLeader = ":",
    visibleCommand = false,
    keys,
  }: Gnofi.ConstructorProps) {
    super()
    this.commandLeader = commandLeader
    this.visibleCommand = visibleCommand
    this._keys = keys
  }

  connect<S extends keyof Gnofi.SignalSignatures>(
    signal: S,
    callback: GObject.SignalCallback<this, Gnofi.SignalSignatures[S]>,
  ): number {
    return super.connect(signal, callback)
  }

  private set activePicker(picker: Picker<any>) {
    if (this._activePicker !== picker) {
      this._activePicker.clear()
      this._activePicker = picker
      this.notify("active-picker")
    }
  }

  private get dockPicker() {
    return this._pickers.get("dock") ?? this._dockPicker
  }

  private get defaultPicker() {
    return this._pickers.get("default") ?? this._defaultPicker
  }

  private get helpPicker() {
    return this._pickers.get("help") ?? this._helpPicker
  }

  addPicker(...pickers: Picker[]) {
    for (const picker of pickers) {
      if (picker.command === "dock" && this.activePicker === this.dockPicker) {
        this.activePicker = picker
        picker.search(this.text)
      }
      this._pickers.set(picker.command, picker)
    }
  }

  [appendChild](child: GObject.Object, type: string | null) {
    if (!(child instanceof Picker)) {
      throw Error("Picker child not an instanceof PickerPicker")
    }

    if (type === "default" || type === "default-only") {
      this.builtinDefaultPicker.addPicker(child)
    }

    if (type !== "default-only") {
      this.addPicker(child)
    }
  }

  removePicker(command: string) {
    this._pickers.delete(command)
  }

  [removeChild](child: GObject.Object) {
    if (child instanceof Picker) {
      this.removePicker(child.command)
      this.builtinDefaultPicker.removePicker(child)
    }
  }

  private parseInput(): [string, Picker?] {
    const { text, commandLeader, _pickers: pickers, defaultPicker } = this

    if (text.startsWith(commandLeader)) {
      const whitespaceIndex = text.search(/\s/)
      const [cmd, args] =
        whitespaceIndex === -1
          ? [text, ""]
          : [text.slice(0, whitespaceIndex), text.slice(whitespaceIndex)]

      const command = cmd.replace(commandLeader, "")
      return [args, pickers.get(command)]
    }

    return [text, defaultPicker]
  }

  private isDefault(picker: Picker) {
    return (
      picker === this.defaultPicker ||
      picker === this.dockPicker ||
      picker === this.helpPicker
    )
  }

  private onText(text: string) {
    // 0. command mode
    if (!this.isDefault(this.activePicker)) {
      // in visibleCommand we go to 3. instead
      if (!this.visibleCommand) return this.activePicker.search(text)
    }

    // 1. dock mode
    if (text === "") {
      return (this.activePicker = this.dockPicker).search(text)
    }

    // 2. default mode
    if (!text.startsWith(this.commandLeader)) {
      return (this.activePicker = this.defaultPicker).search(text)
    }

    const [txt, picker] = this.parseInput()

    // 3. command mode
    if (picker && !this.isDefault(picker) && txt !== "") {
      if (!this.visibleCommand) this.text = txt.trim()
      return (this.activePicker = picker).search(txt)
    }

    // 4. help mode
    return (this.activePicker = this.helpPicker).search(text)
  }

  private onActivate(): void {
    if (this.visibleCommand) {
      const [txt, picker] = this.parseInput()
      picker?.activate(txt)
    } else {
      this.activePicker.activate(this.text)
    }
  }

  private onComplete(): string | void {
    let complete: string | boolean

    if (this.visibleCommand) {
      const [txt, picker] = this.parseInput()
      complete = picker?.complete(txt) ?? ""
      if (typeof complete === "string" && complete) {
        return picker ? `${this.commandLeader}${picker.command} ${complete}` : complete
      }
    } else {
      complete = this.activePicker.complete(this.text)
      if (typeof complete === "string" && complete) {
        return complete
      }
    }
  }

  keypress({ key, focusedEntry, controlMod }: Gnofi.Event): boolean {
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
          !this.isDefault(this.activePicker) &&
          this.text === ""
        ) {
          const { command } = this.activePicker
          this.activePicker = this.dockPicker
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
          this.text += String.fromCharCode(key)
          this.focus("entry")
          return true
        }
      }
    }

    return false
  }
}
