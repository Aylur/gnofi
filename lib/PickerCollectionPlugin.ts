import { type GType, ParamSpec, register, property } from "gnim/gobject"
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

  @property(Array) plugins = new Array<PickerPlugin<unknown>>()

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
    this.plugins.push(plugin)
    this.notify("plugins")
  }

  removePlugin(plugin: PickerPlugin<unknown>) {
    this.plugins = this.plugins.filter((p) => p !== plugin)
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
