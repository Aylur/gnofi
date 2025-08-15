import { type GType, register, property } from "gnim/gobject"
import { PickerPlugin } from "./PickerPlugin"
import { type Picker } from "./Picker"

export namespace HelpPickerPlugin {
  export interface ConstructorProps extends PickerPlugin.ConstructorProps {
    picker: Picker
  }
}

@register()
export class HelpPickerPlugin extends PickerPlugin<PickerPlugin<unknown>> {
  declare static $gtype: GType<HelpPickerPlugin>
  declare $signals: PickerPlugin.SignalSignatures<PickerPlugin<unknown>>

  @property(Boolean) showAll = false
  @property(Boolean) enableCompletion = false

  private picker: Picker

  constructor({
    picker,
    icon = "dialog-question-symbolic",
    ...props
  }: HelpPickerPlugin.ConstructorProps) {
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

  activate(text: string | PickerPlugin<unknown>): void {
    const p = text instanceof PickerPlugin ? text : this.search(text).at(0)
    if (p) this.picker.text = `${this.picker.commandLeader}${p.command} `
  }

  search(text: string): Array<PickerPlugin<unknown>> {
    const { commandLeader, plugins } = this.picker
    return (this.result = this.showAll
      ? plugins
      : plugins.filter(
          (plugin) =>
            plugin.command.startsWith(text.slice(commandLeader.length)) &&
            plugin.description,
        ))
  }
}
