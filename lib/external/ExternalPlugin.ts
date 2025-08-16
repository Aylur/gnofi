import { register, signal } from "gnim/gobject"
import { PickerPlugin } from "../PickerPlugin"
import type { Request } from "./subprocess"
import type { Picker } from "../Picker"

export namespace ExternalPlugin {
  export interface SignalSignatures extends PickerPlugin.SignalSignatures<unknown> {
    "set-props": (id: string, props: object) => void
    "action": (data: unknown) => void
    "warning": (warning: unknown) => void
    "error": (error: unknown) => void
    "log": (error: unknown) => void
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

  @signal(Object)
  error(error: unknown): void {
    void error
  }

  @signal(Object)
  warning(warning: unknown): void {
    void warning
  }

  @signal(Object)
  log(log: unknown): void {
    void log
  }

  @signal(Object)
  action(data: unknown) {
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
      this.request(text)
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

      case "clear":
        this.clear()
        break

      case "result":
        this.result = [payload]
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

      // batch
      case "batch":
        if (Array.isArray(payload)) {
          payload.map((req: Request) => this.handleRequest(req))
        }
        break
      default:
        this.error("unknown request action '%s'".format(action))
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

  protected async request(_action: string, _payload?: unknown): Promise<void> {
    throw Error("missing implementation")
  }

  public destroy() {
    throw Error("missing implementation")
  }
}
