import Gio from "gi://Gio?version=2.0"
import GLib from "gi://GLib?version=2.0"

function proc(cmd: string | string[]) {
  let argv: string[]

  if (typeof cmd === "string") {
    const [, out] = GLib.shell_parse_argv(cmd)
    if (!out) throw Error("error parsing cmd")
    argv = out
  } else {
    argv = cmd
  }

  return Gio.Subprocess.new(
    argv,
    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
  )
}

export function exec(cmd: string | string[]): string {
  const p = proc(cmd)

  const [, stdout, stderr] = p.communicate_utf8(null, null)
  if (p.get_successful()) {
    return stdout.trim()
  } else {
    throw Error(stderr.trim())
  }
}

export function execAsync(cmd: string | string[]): Promise<string> {
  const p = proc(cmd)

  return new Promise((resolve, reject) => {
    p.communicate_utf8_async(null, null, (_, res) => {
      const [, stdout, stderr] = p.communicate_utf8_finish(res)
      void (p.get_successful() ? resolve(stdout!.trim()) : reject(stderr!.trim()))
    })
  })
}

const encoder = new TextEncoder()

export function writeFileAsync(path: string, content: string): Promise<void> {
  const dir = GLib.path_get_dirname(path)

  if (!GLib.file_test(dir, GLib.FileTest.IS_DIR)) {
    Gio.File.new_for_path(dir).make_directory_with_parents(null)
  }

  return new Promise((resolve, reject) => {
    Gio.File.new_for_path(path).replace_contents_async(
      encoder.encode(content),
      null,
      false,
      Gio.FileCreateFlags.NONE,
      null,
      (file, res) => {
        try {
          resolve(void file!.replace_contents_finish(res))
        } catch (error) {
          reject(error)
        }
      },
    )
  })
}

export function ls(
  dir: string,
  props?: {
    level?: number
    includeHidden?: boolean
  },
) {
  const { level = 0, includeHidden = false } = props ?? {}

  if (!GLib.file_test(dir, GLib.FileTest.IS_DIR)) {
    throw Error("not a directory")
  }

  const enumerator = Gio.File.new_for_path(dir).enumerate_children(
    Gio.FILE_ATTRIBUTE_STANDARD_NAME,
    Gio.FileQueryInfoFlags.NONE,
    null,
  )

  const files: Gio.File[] = []

  for (const info of enumerator) {
    const file = enumerator.get_child(info)
    const type = file.query_file_type(Gio.FileQueryInfoFlags.NONE, null)

    if (file.get_basename()?.startsWith(".") && !includeHidden) {
      continue
    }

    if (type === Gio.FileType.DIRECTORY && level > 0) {
      files.push(
        ...ls(file.get_path()!, {
          includeHidden,
          level: level - 1,
        }),
      )
    } else {
      files.push(file)
    }
  }

  return files
}
