// @ts-nocheck -- this isolated fixture owns a separate @/ alias root.
import { unclassifiedFixtureAction } from '@/lib/actions/unclassified'
import { barrelFixtureAction } from '@/lib/actions'
import defaultFixtureAction from '@/lib/actions/default'
import type { typeOnlyFixtureAction } from '@/lib/actions/type-only'
import './cycle-a'

const loadLazyFixture = () => import('./lazy-fixture')

export default function FixtureShell() {
  const fixtureId = 'new'
  void loadLazyFixture
  void (null as unknown as typeof typeOnlyFixtureAction)
  void fetch(`/api/fixture/${fixtureId}/asset`, { headers: { accept: 'application/json' }, method: 'DELETE' })
  return <>
    <form action={unclassifiedFixtureAction}><button>Run action</button></form>
    <form action={barrelFixtureAction}><button>Run barrel action</button></form>
    <form action={defaultFixtureAction}><button>Run default action</button></form>
    <form method={'POST' as const} className="fixture" action={`/api/fixture/${fixtureId}`}><button>Run route</button></form>
    <form><button formAction="/api/fixture/alternate" formMethod="PATCH">Run alternate route</button></form>
  </>
}
