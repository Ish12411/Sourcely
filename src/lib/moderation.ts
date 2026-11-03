import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

/*
  Offensive-language filter for questions (App Store Guideline 1.2: apps with
  user-generated content must filter objectionable material). Questions in a
  group thread are seen by everyone with the link, so they are checked before
  anything is searched or shared.

  The library's matching catches disguised spellings ("sh1t", "f.u.c.k").
  Academic words that merely contain a flagged string are allowed explicitly:
  tested against a batch of ordinary research questions, the stock list
  blocked "the Assyrian empire" and "Moby Dick". Each entry here was a real
  false positive or an obvious neighbour of one.
*/
const ACADEMIC_ALLOWED = [
  "assyria", "assyrian", "assyrians", "assisi", "moby dick", "philip k. dick", "dick cheney",
  "van dyke", "pussy riot", "cockpit", "cockerel", "cockatoo", "hancock", "peacock", "babcock",
  "shitake", "shiitake", "sextant", "sextet", "sexton", "middlesex", "essex", "sussex", "wessex",
  "dickens", "dickinson", "cumbria", "cumulus", "scunthorpe", "penistone", "analytics",
  "therapist", "titration", "bitumen", "rapeseed", "arsenal", "cockney", "nigeria", "niger river",
];

const built = englishDataset.build();
const matcher = new RegExpMatcher({
  blacklistedTerms: built.blacklistedTerms,
  whitelistedTerms: [...(built.whitelistedTerms ?? []), ...ACADEMIC_ALLOWED],
  ...englishRecommendedTransformers,
});

export function isOffensive(text: string): boolean {
  return matcher.hasMatch(text);
}

export const OFFENSIVE_MESSAGE =
  "That question includes language Sourcely doesn't allow. Rephrase it and try again.";
