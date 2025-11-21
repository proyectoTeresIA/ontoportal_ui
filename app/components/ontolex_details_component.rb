# frozen_string_literal: true

class OntolexDetailsComponent < ViewComponent::Base
  include ApplicationHelper
  include OntologiesHelper
  include MultiLanguagesHelper
  include ApiPathHelper

  renders_one :header, TableComponent
  renders_many :sections, TableRowComponent

  attr_reader :entity_data, :entity_type

  def initialize(id:, acronym:, entity_id: nil, entity_type:, entity_data: nil, top_keys: [], bottom_keys: [], exclude_keys: [])
    @acronym = acronym
    @entity_data = entity_data
    @entity_type = entity_type
    @top_keys = top_keys
    @bottom_keys = bottom_keys
    @exclude_keys = exclude_keys
    @id = id
    @entity_id = entity_id
  end

  def add_sections(keys, &block)
    scheme_set = properties_set_by_keys(keys, entity_data)
    rows = row_hash_properties(scheme_set, &block)

    rows.each do |row|
      section do |table_row|
        table_row.create(*row)
      end
    end
  end

  def row_hash_properties(properties_set, &block)
    out = []
    properties_set&.each do |key, value|
      next if value.nil? || (value.is_a?(Array) && value.empty?)

      values = value.is_a?(Array) ? value : [value]
      
      rendered_values = values.map do |v|
        if block_given?
          capture(v, &block)
        else
          render_value(v, key)
        end
      end

      out << [
        { th: content_tag(:span, key.to_s.humanize, 'data-controller': 'tooltip') },
        { td: list_items_component(max_items: 5) { |r| rendered_values.map { |val| r.container { val.html_safe } } } }
      ]
    end
    out
  end

  def render_value(value, key)
    if value.is_a?(String) && (value.start_with?('http://') || value.start_with?('https://'))
      # Check if it's a link to another OntoLex entity
      entity_link = detect_ontolex_link(value)
      if entity_link
        get_link_for_ontolex_entity(value, @acronym, entity_link, '_blank', false)
      else
        content_tag(:code, value.split('/').last, class: 'small')
      end
    elsif value.is_a?(Hash)
      # Handle complex objects (e.g., with language tags)
      text = value['value'] || value['label'] || value.to_s
      lang = value['language']
      html = text
      html += content_tag(:span, lang, class: 'badge bg-secondary ms-2') if lang
      html
    else
      content_tag(:span, value.to_s)
    end
  end

  def detect_ontolex_link(uri)
    # Detect if URI is a link to another OntoLex entity
    return 'lexical_concepts' if uri.include?('/lexical_concepts/')
    return 'lexical_entries' if uri.include?('/lexical_entries/')
    return 'lexical_senses' if uri.include?('/lexical_senses/')
    return 'forms' if uri.include?('/forms/')
    nil
  end

  def properties_set_by_keys(keys, entity_data, exclude_keys = [])
    return {} unless entity_data

    entity_data.select do |k, v|
      (keys.empty? || keys.include?(k.to_s) || keys.include?(k.to_sym)) && 
        !exclude_keys.include?(k.to_s) && !exclude_keys.include?(k.to_sym)
    end
  end

  def filter_properties(top_keys, bottom_keys, exclude_keys, entity_data)
    all_keys = entity_data&.keys&.map(&:to_s) || []
    top_set = properties_set_by_keys(top_keys, entity_data, exclude_keys)
    bottom_set = properties_set_by_keys(bottom_keys, entity_data, exclude_keys)
    leftover = entity_data.reject { |key, _| top_set.key?(key) || bottom_set.key?(key) || exclude_keys.include?(key.to_s) || exclude_keys.include?(key.to_sym) }
    [top_set, leftover, bottom_set]
  end

  def entity_type_title
    @entity_type.to_s.humanize.titleize
  end
end
