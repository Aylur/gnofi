import { register } from "gnim/gobject"
import { request, unknownStr } from "./subprocess"
import { ExternalPlugin } from "./ExternalPlugin"
import Gio from "gi://Gio?version=2.0"

@register()
export class TransientPlugin extends ExternalPlugin {
  private cancellable?: Gio.Cancellable = new Gio.Cancellable()

  protected async request(action: string, payload?: unknown) {
    try {
      this.handleRequest(
        await request(this.executable, [action, payload], this.cancellable),
      )
    } catch (error) {
      this.error(unknownStr(error))
    }
  }

  public destroy(): void {
    this.cancellable?.cancel()
    delete this.cancellable
  }
}
