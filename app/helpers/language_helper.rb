module LanguageHelper
  include ApiPathHelper

  # Fetches unique language codes across all OntoLex submissions from the API.
  # Result is cached in Rails.cache for 30 minutes.
  def ontolex_language_codes
    Rails.cache.fetch('ontolex_language_codes', expires_in: 30.minutes) do
      begin
        raw = LinkedData::Client::HTTP.get(api_path('ontolex_languages'), {}, { raw: true })
        codes = JSON.parse(raw)
        codes.is_a?(Array) ? codes : []
      rescue => _e
        []
      end
    end
  end

  # Returns language select options: [['Català (cat)', 'cat'], ...]
  # Always prepends an "all" option with empty value.
  def ontolex_language_options(all_label)
    codes = ontolex_language_codes
    opts  = [[all_label, '']]
    codes.each do |code|
      name = language_name(code)
      opts << ["#{name} (#{code})", code]
    end
    opts
  end

  # Returns the preferred display name for an ISO 639-2/1 language code.
  # Looks up the first native name (or first international name as fallback).
  # Returns the code itself if not found.
  def language_name(code, prefer_native: true)
    return code.to_s if code.blank?
    entry = LanguageHelper.iso639_data[code.to_s]
    return code.to_s unless entry

    names = prefer_native ? (entry['native'].presence || entry['int'].presence) \
                          : (entry['int'].presence || entry['native'].presence)
    names&.first || code.to_s
  end

  # Returns a JSON string mapping ISO 639 codes to their preferred display names.
  # Suitable for embedding as a JS variable: var languageNames = <%= language_names_json.html_safe %>;
  def language_names_json
    LanguageHelper.names_json_cache
  end

  # ---- Module-level helpers (cached per process) ----

  def self.iso639_data
    @iso639_data ||= begin
      path = Rails.root.join('config', 'iso639.json')
      JSON.parse(File.read(path))
    rescue => _e
      {}
    end
  end

  def self.names_json_cache
    @names_json_cache ||= begin
      hash = iso639_data.transform_values do |v|
        names = v['native'].presence || v['int'].presence
        names&.first
      end.compact
      hash.to_json
    end
  end
end
