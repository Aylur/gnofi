import { register } from "gnim/gobject"
import { subprocess, unknownStr } from "./subprocess"
import { ExternalPlugin } from "./ExternalPlugin"

@register()
export class PersistentPlugin extends ExternalPlugin {
  declare private proc?: ReturnType<typeof subprocess>

  constructor(props: ExternalPlugin.ConstructorProps) {
    super(props)
    try {
      this.proc = subprocess({
        executable: this.executable,
        onError: this.error.bind(this),
        onLog: this.log.bind(this),
        onRequest: (req) => {
          try {
            this.handleRequest(req)
          } catch (error) {
            this.error(unknownStr(error))
          }
        },
      })
    } catch (error) {
      this.error(unknownStr(error))
    }
  }

  protected async request(action: string, payload?: unknown) {
    if (!this.proc) {
      this.error("Cannot send request: subprocess failed")
    }

    this.proc?.request(action, payload)
  }

  public destroy() {
    this.proc?.exit()
  }
}
