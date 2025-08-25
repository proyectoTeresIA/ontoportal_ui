# ontologies_api_client init (default config works for the UI)
require 'ontologies_api_client'

LinkedData::Client.config do |config|
  config.cache        = $CLIENT_REQUEST_CACHING
  config.rest_url     = ENV['API_URL']
  config.purl_prefix  = $PURL_PREFIX || ENV['PURL_PREFIX']
  config.purl_host    = ENV['PURL_HOST']
  config.debug_client = $DEBUG_RUBY_CLIENT || false
  config.debug_client_keys = $DEBUG_RUBY_CLIENT_KEYS || []
  config.apikey = $API_KEY
  config.ui_url = $UI_URL
end
