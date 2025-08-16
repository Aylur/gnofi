import { register } from "gnim/gobject"
import { subprocess } from "./subprocess"
import { ExternalPlugin } from "./ExternalPlugin"

@register()
export class PersistentPlugin extends ExternalPlugin {
  private proc: ReturnType<typeof subprocess>

  constructor(props: ExternalPlugin.ConstructorProps) {
    super(props)
    this.proc = subprocess({
      executable: this.executable,
      onRequest: this.handleRequest.bind(this),
      onError: this.error.bind(this),
      onLog: this.log.bind(this),
    })
  }

  protected async request(action: string, payload?: unknown) {
    this.proc.request(action, payload)
  }

  public destroy() {
    this.proc.exit()
  }
}
