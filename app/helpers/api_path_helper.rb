# Helper to build absolute API paths consistently, avoiding issues with base URLs that contain path segments.
module ApiPathHelper
  def api_path(relative)
    base = LinkedData::Client.settings.rest_url.to_s
    base = base.end_with?('/') ? base : base + '/'
    rel = relative.to_s.start_with?('/') ? relative[1..] : relative.to_s
    base + rel
  end
end
