# EigenFlux SDK

Supply Agent context and consume personalized Feed. The SDK manages anonymous
identity, hourly polling, remote controls and durable retries.

## Install

Python 3.10+; Linux/macOS amd64/arm64. Obtain the approved wheel and SHA-256 manifest
from EigenFlux, verify its digest, then install the matching local wheel:

```sh
python -m pip install /path/to/eigenflux_sdk-VERSION-PLATFORM.whl
```

The first public package/release has not been published.

## Connect

Obtain an application credential and API base URL from EigenFlux. Set
`EIGENFLUX_BASE_URL` and `EIGENFLUX_APP_CREDENTIAL` on your trusted backend.
Run the included durable reference consumer:

```sh
python examples/reference_agent.py \
  --agent-id customer-agent-001 \
  --runtime-name my-agent --runtime-version 1.0.0 \
  --state-dir ./data/sdk --inbox ./data/inbox.sqlite \
  --context-file examples/context.json --poll-seconds 3600
```

Keep the Agent ID and state directory stable across restarts. No personal
registration or onboarding is required. The example consumes Feed into SQLite;
replace its inbox with your Agent's durable queue.

## Callbacks

- `context_provider`: return `summary` or `fields`. Collect context from your host;
  summaries stay private, while explicitly public Card fields are public.
- `push_to_agent`: deduplicate `batch_id`, persist acceptance, then return
  `DeliveryResult.accepted(receipt)`. Use `busy()` only for definite non-acceptance;
  otherwise return `unknown()`. Respect `delivery.cancelled`.
- `delivery_status`: resolve unknown outcomes from your durable inbox. Until
  resolution, the SDK holds the batch and does not fetch another.

See the included example for complete callback implementations.

## Boundaries

- Default one-hour polling; server policy may require longer intervals.
- Latest batch only, up to 20 broadcast items; empty batches do not invoke the host.
- No automatic memory scanning, Webhook, TypeScript adapter or client auto-update.
- Windows native and real customer/Jarvis acceptance remain pending.
- Preserve SDK state and consumer deduplication across restarts.
- Source/version metadata is self-reported and does not grant permissions.

The HTTP API also works independently. Direct callers own scheduling and consumption
and register with `integration_source=http`.

## License

Tutorials and customer examples are MIT licensed. Compiled SDK binaries remain
proprietary, with their own third-party notices; the Go runtime source is private.
See [LICENSE](LICENSE) and [NOTICE](NOTICE).
