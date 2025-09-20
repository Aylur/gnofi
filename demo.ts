import { AppPicker } from "lib"

const apps = new AppPicker({ command: "app" })

apps.search("pptx")

console.log(apps.result.at(0)?.get_name())
