import { useState } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

type Scenario = {
  id: string
  label: string
  path: string
  kind: 'ok' | 'client-error' | 'server-error' | 'slow'
}

const SCENARIOS: Scenario[] = [
  { id: 'ok', label: '200 OK', path: '/api/status', kind: 'ok' },
  { id: 'bad-request', label: '400 Bad Request', path: '/api/simulate/bad-request', kind: 'client-error' },
  { id: 'not-found', label: '404 Not Found', path: '/api/simulate/not-found', kind: 'client-error' },
  { id: 'server-error', label: '500 Server Error', path: '/api/simulate/server-error', kind: 'server-error' },
  { id: 'slow', label: 'Slow (5 s)', path: '/api/simulate/slow?delayMs=5000', kind: 'slow' },
]

type RequestResult = {
  scenario: Scenario
  httpStatus: number
  durationMs: number
  body: unknown
}

type RequestState =
  | { status: 'idle' }
  | { status: 'loading'; scenario: Scenario }
  | { status: 'done'; result: RequestResult }
  | { status: 'network-error'; scenario: Scenario; error: string }

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function callApi(scenario: Scenario): Promise<RequestResult> {
  const startedAt = performance.now()
  const response = await fetch(`${API_BASE_URL}${scenario.path}`)
  const body = await readBody(response)
  return {
    scenario,
    httpStatus: response.status,
    durationMs: Math.round(performance.now() - startedAt),
    body,
  }
}

function App() {
  const [state, setState] = useState<RequestState>({ status: 'idle' })

  const runScenario = async (scenario: Scenario) => {
    setState({ status: 'loading', scenario })
    try {
      setState({ status: 'done', result: await callApi(scenario) })
    } catch (err) {
      setState({
        status: 'network-error',
        scenario,
        error: err instanceof Error ? err.message : 'Something went wrong',
      })
    }
  }

  const isLoading = state.status === 'loading'

  return (
    <main className="app">
      <h1>Azure App Placeholder</h1>
      <p className="subtitle">React UI &rarr; .NET API</p>

      <div className="buttons">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            className={`scenario-button ${scenario.kind}`}
            onClick={() => runScenario(scenario)}
            disabled={isLoading}
          >
            {isLoading && state.scenario.id === scenario.id ? 'Calling...' : scenario.label}
          </button>
        ))}
      </div>

      {state.status === 'done' && (
        <div className={`result ${state.result.httpStatus < 400 ? 'success' : 'error'}`}>
          <p>
            <strong>HTTP {state.result.httpStatus}</strong> from <code>{state.result.scenario.path}</code>
          </p>
          <p className="meta">{state.result.durationMs} ms</p>
          {state.result.body !== null && (
            <pre className="body">{JSON.stringify(state.result.body, null, 2)}</pre>
          )}
        </div>
      )}

      {state.status === 'network-error' && (
        <div className="result error">
          <p>Could not reach the API.</p>
          <p className="meta">{state.error}</p>
        </div>
      )}
    </main>
  )
}

export default App
