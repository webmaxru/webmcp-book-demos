# List the tools (and check their schemas for portability problems)
npx @modelcontextprotocol/inspector --cli node src/stdio.js \
  --method tools/list --strict

# Call a tool with arguments
npx @modelcontextprotocol/inspector --cli node src/stdio.js \
  --method tools/call --tool-name search_products \
  --tool-arg query=tent maxPrice=4000 inStockOnly=true

# Read the resource and render the prompt
npx @modelcontextprotocol/inspector --cli node src/stdio.js \
  --method resources/read --uri trailhead://policies/returns
npx @modelcontextprotocol/inspector --cli node src/stdio.js \
  --method prompts/get --prompt-name packing_list \
  --prompt-args trip="Jotunheimen in October" nights=3
