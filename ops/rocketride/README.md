# Rocket Ride: the Pipeline agent's jobs

Rocket Ride runs the price-data jobs that don't need to happen while a reseller is waiting.

## screen-outliers (live on Rocket Ride Cloud)

`screen-outliers.pipe`: webhook → **anomaly detector (IQR)** → response. It screens one price-index
entry's sold prices for outliers (SPEC BR-12) and compares the result with the app's reference rule.

```bash
cd ops/rocketride && npm install           # Rocket Ride TypeScript SDK
node ops/rocketride/screen-outliers.mjs "patagonia synchilla mens l"            # from the repo root
node ops/rocketride/screen-outliers.mjs "patagonia synchilla mens l" --report   # also report to Atlas over BAND
```

First run (Oct 7): 40 sold prices screened on Rocket Ride Cloud in ~34s; flagged $332.45 and $275.
The app's BR-12 rule also flags $249.99. Rocket Ride's detector is rolling, so borderline values
differ; the app's rule stays authoritative until they match.

Open the `.pipe` file in VS Code with the RocketRide extension to see it as a diagram.

## Tried and dropped

A verdict-voice pipeline (text → Kokoro text-to-speech) failed on Rocket Ride Cloud:
`Model load failed: No loader for model type: kokoro`. Revisit with a local engine or another
voice provider.
