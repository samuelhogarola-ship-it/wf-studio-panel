// @ts-nocheck -- this isolated fixture owns a separate @/ alias root.
import { dynamicFixtureAction } from '@/lib/actions/dynamic'

export default function LazyFixture() {
  return <form action={dynamicFixtureAction}><button>Run dynamic action</button></form>
}
