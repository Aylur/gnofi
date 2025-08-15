import Gdk from "gi://Gdk?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import { createBinding, onCleanup, type CCProps, type FCProps } from "gnim"
import type { Picker } from "../lib/Picker"
import { jsx } from "gnim"

export namespace Entry {
  export type Props = FCProps<
    Gtk.Text,
    Partial<CCProps<Gtk.Text, Omit<Gtk.Text.ConstructorProps, "placeholderText">>> & {
      placeholderText?: string
      picker: Picker
    }
  >
}

export function Entry({ picker, placeholderText, ...props }: Entry.Props) {
  let text: Gtk.Text

  const input = createBinding(picker, "text")
  const activePlugin = createBinding(picker, "activePlugin")

  const id = picker.connect("focus", (_, target) => {
    const Target = target.toUpperCase() as Uppercase<Picker.FocusTarget>
    switch (Target) {
      case "ENTRY":
        text.grab_focus()
        text.set_position(-1)
        return
      case "FORWARD":
      case "BACKWARD":
        return text.emit("move-focus", Gtk.DirectionType[`TAB_${Target}`])
      case "UP":
      case "DOWN":
      case "RIGHT":
      case "LEFT":
        return text.emit("move-focus", Gtk.DirectionType[Target])
    }
  })

  onCleanup(() => picker.disconnect(id))

  return jsx(Gtk.Text, {
    $: (self) => (text = self),
    ...props,
    placeholderText: activePlugin((p) => p.hint || placeholderText || ""),
    text: input,
    onNotifyText: (self) => (picker.text = self.text),
    onActivate: (self) => {
      picker.keypress({
        focused: self.hasFocus,
        key: Gdk.KEY_Return,
      })
    },
    onBackspace: (self) => {
      picker.keypress({
        focused: self.hasFocus,
        key: Gdk.KEY_BackSpace,
      })
    },
    children: KeyController({ picker }),
  })
}

export function KeyController({ picker }: { picker: Picker }) {
  return jsx(Gtk.EventControllerKey, {
    propagationPhase: Gtk.PropagationPhase.BUBBLE,
    onKeyPressed: ({ widget }, key) => {
      return picker.keypress({
        focused: widget.hasFocus,
        key,
      })
    },
  })
}
