import { atom, useAtom } from 'jotai'

const forcedToolsAtom = atom<string[]>([])

export function useForcedTools() {
  const [tools, setTools] = useAtom(forcedToolsAtom)
  const toggle = (id: string) =>
    setTools(p => (p.includes(id) ? p.filter(i => i !== id) : [...p, id]))
  return { tools, toggle }
}