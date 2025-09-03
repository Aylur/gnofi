import { register } from "gnim/gobject"
import { request, errorStr } from "./subprocess"
import { ExternalPicker } from "./ExternalPicker"
import Gio from "gi://Gio?version=2.0"

@register()
export class TransientExternalPicker extends ExternalPicker {
  private cancellable?: Gio.Cancellable = new Gio.Cancellable()

  protected async request(action: string, payload?: unknown) {
    try {
      this.handleRequest(
        await request(this.executable, [action, payload], this.cancellable),
      )
    } catch (error) {
      this.error(errorStr(error))
    }
  }

  public destroy(): void {
    this.cancellable?.cancel()
    delete this.cancellable
  }
}
