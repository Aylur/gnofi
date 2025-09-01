import GObject, {
  property,
  register,
  signal,
  getter,
  AccumulatorType,
  type ParamSpec,
  type GType,
} from "gnim/gobject"

export namespace PickerPlugin {
  export interface ConstructorProps extends GObject.Object.ConstructorProps {
    command: string
    description?: string
    hint?: string
    icon?: string
  }

  export interface SignalSignatures<T> extends GObject.Object.SignalSignatures {
    "notify::command": (pspec: ParamSpec<string>) => void
    "notify::description": (pspec: ParamSpec<string>) => void
    "notify::hint": (pspec: ParamSpec<string>) => void
    "notify::icon": (pspec: ParamSpec<string>) => void
    "notify::result": (pspec: ParamSpec<Array<T>>) => void
    "clear": () => void
    "search": (text: string) => void
    "activate": (text: string) => void
    "complete": (text: string) => string | void
  }
}

@register()
export class PickerPlugin<T> extends GObject.Object {
  declare static $gtype: GType<PickerPlugin<any>>
  declare $signals: PickerPlugin.SignalSignatures<T>

  @property(String) command: string
  @property(String) description = ""
  @property(String) hint = ""
  @property(String) icon = "system-search-symbolic"

  private _result = new Array<T>()

  @getter(Array) get result(): Array<T> {
    return this._result
  }

  protected set result(result: Array<T>) {
    this._result = result
    this.notify("result")
  }

  @signal() clear() {}

  @signal(String)
  search(text: string): void {
    return void text
  }

  @signal(String)
  activate(text: string): void {
    return void text
  }

  @signal([String], String, {
    default: false,
    accumulator: AccumulatorType.FIRST_WINS,
  })
  complete(text: string): string {
    throw text
  }

  constructor({ command, description, hint, icon }: PickerPlugin.ConstructorProps) {
    super()
    this.command = command
    this.hint = hint ?? ""
    this.description = description ?? ""
    this.icon = icon ?? "system-search-symbolic"
  }

  connect<S extends keyof PickerPlugin.SignalSignatures<T>>(
    signal: S,
    callback: GObject.SignalCallback<this, PickerPlugin.SignalSignatures<T>[S]>,
  ): number {
    return super.connect(signal, callback)
  }
}
