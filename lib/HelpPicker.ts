import { type GType, register, property } from "gnim/gobject"
import { Picker } from "./Picker"
import { type Gnofi } from "./Gnofi"

export namespace HelpPicker {
  export interface ConstructorProps extends Picker.ConstructorProps {
    picker: Gnofi
  }
}

@register()
export class HelpPicker extends Picker<Picker> {
  declare static $gtype: GType<HelpPicker>
  declare $signals: Picker.SignalSignatures<Picker>

  @property(Boolean) showAll = false
  @property(Boolean) enableCompletion = false

  private picker: Gnofi

  constructor({
    picker,
    icon = "dialog-question-symbolic",
    ...props
  }: HelpPicker.ConstructorProps) {
    super({ icon, ...props })
    this.picker = picker
  }

  complete(text: string): string {
    if (this.enableCompletion) {
      const p = this.search(text).at(0)
      return p ? `${this.picker.commandLeader}${p.command} ` : ""
    }
    return ""
  }

  activate(text: string | Picker): void {
    const p = text instanceof Picker ? text : this.search(text).at(0)
    if (p) this.picker.text = `${this.picker.commandLeader}${p.command} `
  }

  search(text: string): Array<Picker> {
    const { commandLeader, pickers } = this.picker
    return (this.result = this.showAll
      ? pickers
      : pickers.filter(
          (picker) =>
            picker.command.startsWith(text.slice(commandLeader.length)) &&
            picker.description,
        ))
  }
}
