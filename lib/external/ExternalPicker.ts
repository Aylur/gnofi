import GObject, { gtype, ParamSpec, property, register, signal } from "gnim/gobject"
import { Picker } from "../Picker"
import type { Request } from "./subprocess"
import type { Gnofi } from "../Gnofi"

export namespace ExternalPicker {
  export interface SignalSignatures extends Picker.SignalSignatures<unknown> {
    "notify::settings": (pspec: ParamSpec<object>) => void
    "set-props": (id: string, props: object) => void
    "action": (data: object) => void
    "warning": (warning: string) => void
    "error": (error: string) => void
    "log": (error: string) => void
  }

  export interface ConstructorProps extends Picker.ConstructorProps {
    gnofi: Gnofi
    executable: string
  }
}

function isFocusTarget(target: unknown): target is Gnofi.FocusTarget {
  const targets: Array<Gnofi.FocusTarget> = [
    "left",
    "right",
    "backward",
    "forward",
    "up",
    "down",
    "entry",
  ]

  return targets.some((t) => t === target)
}

type Settings = Record<string | number, unknown>
const Settings = gtype<Settings>(Object)

/** @abstract */
@register()
export class ExternalPicker extends Picker<unknown> {
  declare $signals: ExternalPicker.SignalSignatures

  readonly executable: string
  private gnofi: Gnofi
  private delay: number = 0
  private debounce?: ReturnType<typeof setTimeout>

  @property(Settings) settings: Settings = {}

  @signal(String, Object)
  setProps(id: string, props: object): void {
    void [id, props]
  }

  @signal(String)
  error(error: string): void {
    void error
  }

  @signal(String)
  warning(warning: string): void {
    void warning
  }

  @signal(String)
  log(log: string): void {
    void log
  }

  @signal(Object)
  action(data: object) {
    this.request("action", data)
  }

  clear(): void {
    super.clear()
    this.request("clear")
  }

  search(text: string): void {
    if (this.debounce) clearTimeout(this.debounce)

    this.debounce = setTimeout(() => {
      super.search(text)
      this.request("search", text)
    }, this.delay)
  }

  activate(text: string): void {
    super.activate(text)
    this.request("activate", text)
  }

  complete(text: string): string {
    this.request("complete", text)
    return ""
  }

  constructor({ gnofi, executable, ...props }: ExternalPicker.ConstructorProps) {
    super(props)
    this.gnofi = gnofi
    this.executable = executable
  }

  protected handleRequest([action, payload]: Request) {
    if (!action) return

    switch (action) {
      case "ignore": {
        break
      }
      case "settings": {
        if (payload === null || typeof payload !== "object") {
          throw Error("invalid setting calls: payload not an object")
        }

        const o = payload as Record<string, unknown>

        if (typeof o.description === "string") this.description = o.description
        if (typeof o.icon === "string") this.icon = o.icon
        if (typeof o.delay === "number") this.delay = o.delay
        if (typeof o.hint === "string") this.hint = o.hint

        this.settings = payload
        break
      }
      case "result": {
        if (!Array.isArray(payload)) {
          return this.error("invalid result call: payload is not an array")
        }

        this.result = payload
        break
      }
      case "result:push": {
        this.result.push(payload)
        this.notify("result")
        break
      }
      case "result:pop": {
        this.result.pop()
        this.notify("result")
        break
      }
      case "result:unshift": {
        this.result.unshift(payload)
        this.notify("result")
        break
      }
      case "result:shift": {
        this.result.shift()
        this.notify("result")
        break
      }
      case "result:slice": {
        let start: number, end: number | undefined

        if (!Array.isArray(payload)) {
          return this.error("invalid result:shift call: payload is not an tuple")
        }

        if (payload.length === 2) {
          ;[start, end] = payload
        } else if (payload.length === 1) {
          ;[start] = payload
        } else {
          return this.error(
            "invalid result:shift call: tuple should have 1 or 2 elements",
          )
        }

        if (typeof start !== "number") {
          return this.error(
            "invalid result:shift call: start paremeter has to be a number",
          )
        }

        if (payload.length === 2 && typeof start !== "number") {
          return this.error("invalid result:shift call: end paremeter has to be a number")
        }

        this.result.slice(start, end)
        this.notify("result")
        break
      }
      case "result:remove": {
        if (typeof payload !== "number") {
          return this.error("invalid result:remove call: payload is not an index number")
        }

        this.result = this.result.filter((_, i) => i !== payload)
        break
      }
      case "set:props": {
        if (typeof payload !== "object" || payload === null) {
          return this.error("invalid set call: payload is not an object")
        }

        if (!("$" in payload) || typeof payload.$ !== "string") {
          return this.error("invalid set call: payload is missing ref id")
        }

        const { $, ...props } = payload
        this.setProps($, props)
        break
      }
      case "set:text": {
        this.gnofi.text = `${payload}`
        break
      }
      case "close": {
        this.gnofi.close()
        break
      }
      case "open": {
        this.gnofi.open("")
        break
      }
      case "focus": {
        if (!isFocusTarget(payload)) {
          return this.error(
            `invalid focus call: payload "${payload}" is not a valid FocusTarget`,
          )
        }
        this.gnofi.focus(payload)
        break
      }
      case "log": {
        this.log(`${payload}`)
        break
      }
      case "log:warning": {
        this.warning(`${payload}`)
        break
      }
      case "log:error": {
        this.error(`${payload}`)
        break
      }
      case "batch": {
        if (Array.isArray(payload)) {
          payload.map((req: Request) => this.handleRequest(req))
        }
        break
      }
      default: {
        this.error(`unknown request action '${action}'`)
        break
      }
    }
  }

  protected async request(action: string, payload?: unknown): Promise<void> {
    void [action, payload]
    throw Error("missing implementation")
  }

  public destroy() {
    throw Error("missing implementation")
  }

  connect<S extends keyof ExternalPicker.SignalSignatures>(
    signal: S,
    callback: GObject.SignalCallback<this, ExternalPicker.SignalSignatures[S]>,
  ): number {
    // @ts-expect-error
    return super.connect(signal, callback)
  }
}
