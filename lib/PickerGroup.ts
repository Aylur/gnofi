import { type GType, ParamSpec, register, getter, property } from "gnim/gobject"
import { Picker } from "./Picker"

export namespace PickerGroup {
  export interface SignalSignatures extends Picker.SignalSignatures<unknown> {
    "notify::pickers": (pspec: ParamSpec<Array<Picker>>) => void
  }
}

@register()
export class PickerGroup extends Picker {
  declare static $gtype: GType<PickerGroup>
  declare $signals: PickerGroup.SignalSignatures

  #pickers = new Map<Picker, () => void>()

  @property(Boolean) hasResult = false

  @getter(Array) get pickers(): Array<Picker> {
    return [...this.#pickers.keys()]
  }

  get result() {
    return this.pickers.flatMap((p) => p.result)
  }

  constructor({ icon = "system-search-symbolic", ...props }: Picker.ConstructorProps) {
    super({ icon, ...props })
  }

  addPicker(picker: Picker) {
    const id = picker.connect("notify::result", () => {
      this.notify("result")
      this.hasResult = this.pickers.reduce((c, p) => c + p.result.length, 0) > 0
    })

    this.#pickers.set(picker, () => picker.disconnect(id))
    this.notify("pickers")
  }

  removePicker(picker: Picker) {
    const cleanup = this.#pickers.get(picker)
    if (cleanup) cleanup()
    this.#pickers.delete(picker)
  }

  clear(): void {
    super.clear()
    this.pickers.forEach((p) => p.clear())
  }

  activate(text: string): void {
    super.activate(text)
    for (const provider of this.pickers) {
      if (provider.result.length >= 0) {
        return provider.activate(text)
      }
    }
  }

  search(text: string): void {
    super.search(text)
    for (const picker of this.pickers) {
      picker.search(text)
    }
  }
}
