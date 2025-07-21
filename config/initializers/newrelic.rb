# Prevent NewRelic initialization errors when license key is not available
# This is especially important during Docker builds and asset precompilation

if ENV['NEW_RELIC_LICENSE_KEY'].blank? &&
   begin
     Rails.application.credentials.dig(:newrelic, :license_key)
   rescue StandardError
     nil
   end.blank?

  puts 'NewRelic disabled - no license key available'

  # Disable NewRelic agent
  ENV['NEW_RELIC_AGENT_ENABLED'] = 'false'
end
