import {explainContextCommand, healthContextCommand, resolveContextCommand} from '../core/gateway-commands.mjs';

export const ADAPTER_BOUNDARY = 'fixture-only';

export function resolveAdapter(input) {
  return resolveContextCommand(input).pack;
}

export function explainAdapter(input) {
  return explainContextCommand(input);
}

export function healthAdapter() {
  return healthContextCommand();
}
