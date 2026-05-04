ui_base_path = ENV["UI_BASE_PATH"].to_s.strip

if !ui_base_path.empty? && ui_base_path != "/"
  ui_base_path = "/#{ui_base_path}" unless ui_base_path.start_with?("/")
  ui_base_path = ui_base_path.gsub(%r{/*$}, "")

  # Configure Rails to mount under a subpath and serve assets from the same prefix.
  Rails.application.config.relative_url_root = ui_base_path
  Rails.application.config.action_controller.default_url_options = {
    script_name: ui_base_path
  }.merge(Rails.application.config.action_controller.default_url_options || {})
  Rails.application.routes.default_url_options[:script_name] = ui_base_path

  if defined?($UI_URL) && $UI_URL
    trimmed_ui_url = $UI_URL.to_s.gsub(%r{/*$}, "")
    $UI_URL = "#{trimmed_ui_url}#{ui_base_path}" unless trimmed_ui_url.end_with?(ui_base_path)
  end

  # Update REST_URL to include the base path when using local API
  if defined?($REST_URL) && $REST_URL
    if $REST_URL.include?("localhost") || $REST_URL.include?("127.0.0.1") || $REST_URL.start_with?("/")
      # For local API calls, prepend the base path
      trimmed_rest_url = $REST_URL.to_s.gsub(%r{/*$}, "")
      # Remove any existing /ontoportal prefix first to avoid double-prefixing
      trimmed_rest_url = trimmed_rest_url.gsub(%r{/ontoportal/?$}, "")
      $REST_URL = "#{trimmed_rest_url}#{ui_base_path}/api" unless trimmed_rest_url.end_with?("#{ui_base_path}/api")
    end
  end

  mailer_defaults = Rails.application.config.action_mailer.default_url_options
  if mailer_defaults
    Rails.application.config.action_mailer.default_url_options = mailer_defaults.merge(script_name: ui_base_path)
  else
    Rails.application.config.action_mailer.default_url_options = { script_name: ui_base_path }
  end
end