import GObject, {
  property,
  register,
  signal,
  getter,
  AccumulatorType,
  type ParamSpec,
  type GType,
} from "gnim/gobject"

export namespace Picker {
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
export class Picker<T = unknown> extends GObject.Object {
  declare static $gtype: GType<Picker<any>>
  declare $signals: Picker.SignalSignatures<T>

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

  constructor({ command, description, hint, icon }: Picker.ConstructorProps) {
    super()
    this.command = command
    this.hint = hint ?? ""
    this.description = description ?? ""
    this.icon = icon ?? "system-search-symbolic"
  }

  connect<S extends keyof Picker.SignalSignatures<T>>(
    signal: S,
    callback: GObject.SignalCallback<this, Picker.SignalSignatures<T>[S]>,
  ): number {
    return super.connect(signal, callback)
  }
}
