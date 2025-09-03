import GLib from "gi://GLib"
import { Picker } from "./Picker"
import { SearchProvider } from "./SearchProviderProxy"
import { property, getter, register } from "gnim/gobject"

export namespace SearchPicker {
  export interface ConstructorProps extends Picker.ConstructorProps {
    provider: SearchProvider.Props
    maxItems?: number
  }
}

@register()
export class SearchPicker extends Picker<SearchProvider.Item> {
  @property(Number) maxItems: number

  @getter(Number) get resultSurplus() {
    return this._resultSurplus
  }

  get app() {
    return this.proxy.appInfo
  }

  private proxy: SearchProvider
  private _resultSurplus = 0

  constructor({ provider, maxItems = 6, ...props }: SearchPicker.ConstructorProps) {
    super(props)
    this.proxy = new SearchProvider(provider)
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
