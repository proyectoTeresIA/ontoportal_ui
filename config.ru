require_relative "config/environment"

map(Rails.application.config.relative_url_root || "/") do
  run BioportalWebUi::Application
end
Rails.application.load_server