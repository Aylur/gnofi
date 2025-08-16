import { register } from "gnim/gobject"
import { request } from "./subprocess"
import { ExternalPlugin } from "./ExternalPlugin"

@register()
export class TransientPlugin extends ExternalPlugin {
  protected async request(action: string, payload?: unknown) {
    try {
      this.handleRequest(await request(this.executable, [action, payload]))
    } catch (error) {
      this.error(error)
    }
  }

  public destroy(): void {
    // nothing to do
  }
}
