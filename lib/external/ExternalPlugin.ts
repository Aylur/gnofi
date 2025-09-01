import GObject, { register, signal } from "gnim/gobject"
import { PickerPlugin } from "../PickerPlugin"
import type { Request } from "./subprocess"
import type { Picker } from "../Picker"

export namespace ExternalPlugin {
  export interface SignalSignatures extends PickerPlugin.SignalSignatures<unknown> {
    "set-props": (id: string, props: object) => void
    "action": (data: object) => void
    "warning": (warning: string) => void
    "error": (error: string) => void
    "log": (error: string) => void
  }

  export interface ConstructorProps extends PickerPlugin.ConstructorProps {
    picker: Picker
    executable: string
  }
}

function isValidFocusTarget(target: unknown): target is Picker.FocusTarget {
  const targets: Array<Picker.FocusTarget> = [
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

@register()
export class ExternalPlugin extends PickerPlugin<unknown> {
  declare $signals: ExternalPlugin.SignalSignatures

  private picker: Picker
  private delay: number = 0
  private debounce?: ReturnType<typeof setTimeout>
  public executable: string

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

  constructor({ picker, executable, ...props }: ExternalPlugin.ConstructorProps) {
    super(props)
    this.picker = picker
    this.executable = executable
  }

  protected handleRequest([action, payload]: Request) {
    if (!action) return

    switch (action) {
      case "ignore":
        break

      case "settings":
        this.applySettings(payload)
        break

      case "result":
        if (!Array.isArray(payload)) {
          return this.error("invalid result call: payload is not an array")
        }

        this.result = payload
        break

      case "result:push":
        this.result.push(payload)
        this.notify("result")
        break

      case "result:pop":
        this.result.pop()
        this.notify("result")
        break

      case "result:unshift":
        this.result.unshift(payload)
        this.notify("result")
        break

      case "result:shift":
        this.result.shift()
        this.notify("result")
        break

      case "result:slice":
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

      case "result:remove":
        if (typeof payload !== "number") {
          return this.error("invalid result:remove call: payload is not an index number")
        }

        this.result = this.result.filter((_, i) => i !== payload)
        break

      case "set": {
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

      // picker
      case "close":
        this.picker.close()
        break
      case "open":
        this.picker.open("")
        break
      case "focus":
        if (!isValidFocusTarget(payload)) {
          return this.error(
            `invalid focus call: payload "${payload}" is not a valid FocusTarget`,
          )
        }
        this.picker.focus(payload)
        break
      case "set:text":
        this.picker.text = `${payload}`
        break

      case "log":
        this.log(`${payload}`)
        break

      case "log:warning":
        this.warning(`${payload}`)
        break

      case "log:error":
        this.error(`${payload}`)
        break

      // batch
      case "batch":
        if (Array.isArray(payload)) {
          payload.map((req: Request) => this.handleRequest(req))
        }
        break
      default:
        this.error(`unknown request action '${action}'`)
        break
    }
  }

  protected applySettings(object: unknown) {
    if (object === null || typeof object !== "object") {
      throw Error("invalid settings: not an object")
    }

    const allowedKeys = ["description", "icon", "delay", "hint"]
    const unknownKeys = Object.keys(object).filter((key) => !allowedKeys.includes(key))
    const o = object as Record<string, unknown>

    if (typeof o.description === "string") this.description = o.description
    if (typeof o.icon === "string") this.icon = o.icon
    if (typeof o.delay === "number") this.delay = o.delay
    if (typeof o.hint === "string") this.hint = o.hint

    if (unknownKeys.length > 0) {
      this.warning(`unknown keys on settings: ${unknownKeys}`)
    }
  }

  protected async request(action: string, payload?: unknown): Promise<void> {
    void [action, payload]
    throw Error("missing implementation")
  }

  public destroy() {
    throw Error("missing implementation")
  }

  connect<S extends keyof ExternalPlugin.SignalSignatures>(
    signal: S,
    callback: GObject.SignalCallback<this, ExternalPlugin.SignalSignatures[S]>,
  ): number {
    // @ts-expect-error
    return super.connect(signal, callback)
  }
}
