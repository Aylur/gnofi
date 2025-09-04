import { register } from "gnim/gobject"
import { subprocess, errorStr } from "./subprocess"
import { ExternalPicker } from "./ExternalPicker"

@register()
export class PersistentExternalPicker extends ExternalPicker {
  declare private proc?: ReturnType<typeof subprocess>

  constructor(props: ExternalPicker.ConstructorProps) {
    super(props)
    try {
      this.proc = subprocess({
        executable: this.executable,
        onError: this.error.bind(this),
        onRequest: (req) => {
          try {
            this.handleRequest(req)
          } catch (error) {
            this.error(errorStr(error))
          }
        },
      })
    } catch (error) {
      this.error(errorStr(error))
    }
  }

  protected async request(action: string, payload?: unknown) {
    if (!this.proc) {
      this.error("cannot send request: subprocess failed")
    }

    this.proc?.request(action, payload)
  }

  public destroy() {
    this.proc?.exit()
  }
}
