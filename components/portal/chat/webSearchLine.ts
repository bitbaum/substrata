/**
 * What a reader is told when the web was searched for their question and no
 * page came back. "Could not be reached" and "found nothing" are different
 * facts: the first is an outage, the second is an answer.
 */
export function webSearchLine(outcome: 'found' | 'nothing' | 'could_not_look' | undefined) {
  if (outcome === 'could_not_look')
    return 'Web search could not be reached just now · no web page was read for this answer';
  if (outcome === 'nothing')
    return 'Web search returned nothing readable · no web page was read for this answer';
  return null;
}
