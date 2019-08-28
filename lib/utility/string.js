import { plural, singular, isPlural, isSingular } from "pluralize";

export function capitalise(string) {
  return string.substr(0, 1).toUpperCase() + string.substr(1);
}

export { isPlural, isSingular };

export const pluralise = plural;
export const singularise = singular;
