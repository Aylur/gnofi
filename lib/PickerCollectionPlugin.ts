import { type GType, ParamSpec, register, getter } from "gnim/gobject"
import { PickerPlugin } from "./PickerPlugin"

export namespace PickerCollectionPlugin {
  export interface SignalSignatures extends PickerPlugin.SignalSignatures<unknown> {
    "notify::plugins": (pspec: ParamSpec<Array<PickerPlugin<unknown>>>) => void
  }
}

@register()
export class PickerCollectionPlugin extends PickerPlugin<unknown> {
  declare static $gtype: GType<PickerCollectionPlugin>
  declare $signals: PickerCollectionPlugin.SignalSignatures

  #plugins = new Map<PickerPlugin<unknown>, () => void>()

  @getter(Array) get plugins(): Array<PickerPlugin<unknown>> {
    return [...this.#plugins.keys()]
  }

  get result() {
    return this.plugins.flatMap((p) => p.result)
  }

  constructor({
    icon = "system-search-symbolic",
    ...props
  }: PickerPlugin.ConstructorProps) {
    super({ icon, ...props })
  }

  addPlugin(plugin: PickerPlugin<unknown>) {
    const id = plugin.connect("notify::result", () => this.notify("result"))
    this.#plugins.set(plugin, () => plugin.disconnect(id))
    this.notify("plugins")
  }

  removePlugin(plugin: PickerPlugin<unknown>) {
    const cleanup = this.#plugins.get(plugin)
    if (cleanup) cleanup()
    this.#plugins.delete(plugin)
  }

  clear(): void {
    super.clear()
    this.plugins.forEach((p) => p.clear())
  }

  activate(text: string): void {
    super.activate(text)
    for (const provider of this.plugins) {
      if (provider.result.length >= 0) {
        return provider.activate(text)
      }
    }
  }

  search(text: string): void {
    super.search(text)
    for (const plugin of this.plugins) {
      plugin.search(text)
    }
  }
}
