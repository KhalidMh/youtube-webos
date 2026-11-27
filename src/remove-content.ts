import { configRead } from './config';
import { addResponseFilter } from './hooks/json-parse';
import { FILTER_OPTIONS, filterResponse } from './response-filters.js';

addResponseFilter('remove-content', (response) => {
  const options = Object.fromEntries(
    FILTER_OPTIONS.map((option) => [option, configRead(option)])
  );
  const { fields, items } = filterResponse(response, options);

  if (fields.length > 0) {
    console.info(`[remove-content] Removed ${fields.join(', ')}`);
  }
  if (items > 0) console.info(`[remove-content] Removed ${items} items`);
});
