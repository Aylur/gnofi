import GLib from "gi://GLib"
import { PickerPlugin } from "./PickerPlugin"
import { SearchProviderProxy } from "./SearchProviderProxy"
import { property, getter, register } from "gnim/gobject"

export namespace SearchPickerPlugin {
  export interface Props extends PickerPlugin.ConstructorProps {
    provider: SearchProviderProxy.Props
    maxItems?: number
  }
}

@register()
export class SearchPickerPlugin extends PickerPlugin<SearchProviderProxy.Item> {
  @property(Number) maxItems: number

  @getter(Number) get resultSurplus() {
    return this._resultSurplus
  }

  get app() {
    return this.proxy.appInfo
  }

  private proxy: SearchProviderProxy
  private _resultSurplus = 0

  constructor({ provider, maxItems = 6, ...props }: SearchPickerPlugin.Props) {
    super(props)
    this.proxy = new SearchProviderProxy(provider)
    this.maxItems = maxItems
  }

  destroy() {
    this.proxy.stop()
  }

  async search(text: string): Promise<void> {
    super.search(text)
    const [surplus, res] = await this.proxy.search(text, this.maxItems)
    this._resultSurplus = surplus
    this.result = res
    this.notify("result-surplus")
  }

  activate(text: string): void {
    super.activate(text)
    this.proxy.LaunchSearch([text], GLib.DateTime.new_now_local().to_unix())
  }
}
