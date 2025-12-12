# frozen_string_literal: true
require 'iso-639'

module OntologiesHelper

  def external_rest_url
    env_url = ENV['EXTERNAL_API_URL']
    return env_url.chomp('/') if env_url && !env_url.empty?
    rest_url
  end

  # Replaces internal host (rest_url) with external if applicable
  def externalize_api_url(url)
    base_internal = rest_url.chomp('/')
    base_external = external_rest_url.chomp('/')
    return url if base_external == base_internal
    if url.start_with?(base_internal)
      return base_external + url[base_internal.length..-1]
    end
    url
  end

  def category_name_chip_component(domain)
    text = domain.split('/').last.titleize

    return render(ChipButtonComponent.new(text: text, tooltip: domain, type: "static")) unless link?(domain)

    acronym = domain.split('/').last
    category = LinkedData::Client::Models::Category.find(acronym)

    if category
      render ChipButtonComponent.new(text: category.name, tooltip: category.id, url: category.id, type: "clickable", target: '_blank')
    else
      render(ChipButtonComponent.new(text: text, tooltip: domain, type: "static"))
    end
  end

  def group_name_chip_component(domain)
    text = domain.split('/').last.titleize

    return render(ChipButtonComponent.new(text: text, tooltip: domain, type: "static")) unless link?(domain)

    acronym = domain.split('/').last
    category = LinkedData::Client::Models::Group.find(acronym)
    if category
      render ChipButtonComponent.new(text: category.name, tooltip: category.id, url: category.id, type: "clickable", target: '_blank')
    else
      render(ChipButtonComponent.new(text: text, tooltip: domain, type: "static"))
    end
  end

  def ontology_retired?(submission)
    submission[:status].to_s.eql?('retired') || submission[:deprecated].to_s.eql?('true')
  end

  def ontology_license_badge(acronym, submission = @submission_latest)
    return if submission.nil?

    no_license = submission.hasLicense.blank?
    render ChipButtonComponent.new(class: "text-nowrap chip_button_small #{no_license && 'disabled-link'}", type: no_license ? 'static' : 'clickable') do
      if no_license
        content_tag(:span) do
          content_tag(:span, t('ontologies.no_license'), class: "mx-1") + inline_svg_tag('icons/law.svg', width: "15px")
        end
      else
        link_to_modal(nil, "/ajax/submission/show_licenses/#{acronym}", data: { show_modal_title_value: t('ontologies.access_rights_information') }) do
          content_tag(:span, t('ontologies.view_license'), class: "mx-1") + inline_svg_tag('icons/law.svg')
        end
      end

    end
  end

  def ontology_retired_badge(submission, small: false, clickable: true)
    return if submission.nil? || !ontology_retired?(submission)
    text_color = submission[:status].to_s.eql?('retired') ? 'text-danger bg-danger-light' : 'text-warning bg-warning-light'
    text_content = submission[:status].to_s.eql?('retired') ? 'Retired' : 'Deprecated'
    style = "#{text_color} #{small && 'chip_button_small'}"
    render ChipButtonComponent.new(class: "#{style} mr-1", text: text_content, type: clickable ? 'clickable' : 'static')
  end

  def ontology_alternative_names(submission = @submission_latest)
    alt_labels = (Array(submission&.alternative) + Array(submission&.hiddenLabel))
    return unless alt_labels.present?

    content_tag(:div, class: 'creation_text') do
      concat(t('ontologies.referred_to'))
      concat(content_tag(:span, class: 'date_creation_text') do
        if alt_labels.length > 1
          concat("#{alt_labels[0..-2].join(', ')} or #{alt_labels.last}.")
        else
          concat("#{alt_labels.first}.")
        end
      end)
    end
  end

  def private_ontology_icon(is_private)
    raw(content_tag(:i, '', class: 'fas fa-key', title: t('ontologies.private_ontology'))) if is_private
  end

  def error_message_text(errors = @errors)
    return errors if errors.is_a?(String)
    errors = errors[:error] if errors && errors[:error]
    t('application.errors_in_fields', errors: errors.keys.join(', '))
  end

  def error_message_alert(errors = @errors)
    return if errors.nil?

    content_tag(:div, class: 'my-1') do
      alert_component(error_message_text(errors), type: 'danger')
    end
  end

  def download_button
    return if (@ontology.summaryOnly || @ont_restricted || @submissions.empty?)

    down_link = externalize_api_url(@submissions.first.id) + "/download?apikey=#{get_apikey}"
    render RoundedButtonComponent.new(link: down_link, icon: 'summary/download.svg',
                                      size: 'medium', title: t('ontologies.download_latest'))
  end

  def ontology_purl_button(purl)
    return unless Rails.configuration.settings.purl[:enabled]

    render RoundedButtonComponent.new(link: purl, icon: 'icons/copy_link.svg',
                                      size: 'medium', title: "#{portal_name} PURL")
  end

  def homepage_button(homepage)
    return unless homepage
    render RoundedButtonComponent.new(link: homepage, icon: 'summary/homepage.svg',
                                      size: 'medium', title: 'Homepage')
  end

  def documentation_button(documentation)
    return unless documentation
    render RoundedButtonComponent.new(link: documentation, icon: 'summary/documentation.svg',
                                      size: 'medium', title: 'Documentation')
  end

  def publication_button(publication)
    render RoundedButtonComponent.new(link: publication, icon: 'icons/publication.svg',
                                      size: 'medium', title: 'Publication')
  end

  def new_submission_button
    return unless @ontology.admin?(session[:user])
    render RoundedButtonComponent.new(link: new_ontology_submission_path(@ontology.acronym), icon: 'icons/plus.svg',
                                      size: 'medium', title: t('ontologies.add_new_submission'))
  end

  def ontology_edit_button
    return unless @ontology.admin?(session[:user])
    render RoundedButtonComponent.new(link: edit_ontology_submission_path(ontology_id: @ontology.acronym, id: @submission_latest.id.split('/').last), icon: 'edit.svg',
                                      size: 'medium',
                                      title: t('ontologies.edit_metadata'))
  end

  def summary_only?
    @ontology&.summaryOnly || @submission&.isRemote&.eql?('3')
  end

  def ontology_pull_location?
    !(@submission.pullLocation.nil? || @submission.pullLocation.empty?)
  end

  def upload_ontology_button
    if session[:user].nil?
      render Buttons::RegularButtonComponent.new(id: "upload-ontology-button", value: t('home.ontology_upload_button'), variant: "secondary", state: "regular", href: "/login?redirect=/ontologies/new") do |btn|
        btn.icon_left do
          inline_svg_tag "upload.svg"
        end
      end
    else
      render Buttons::RegularButtonComponent.new(id: "upload-ontology-button", value: t('home.ontology_upload_button'), variant: "secondary", state: "regular", href: new_ontology_path) do |btn|
        btn.icon_left do
          inline_svg_tag "upload.svg"
        end
      end
    end
  end

  LANGUAGE_FILTERABLE_SECTIONS = %w[classes].freeze

  def ontology_object_json_link(ontology_acronym, object_type, id)
    "#{external_rest_url}/ontologies/#{ontology_acronym}/#{object_type}/#{escape(id)}?display=all&apikey=#{get_apikey}"
  end

  def render_permalink_link
    content_tag(:div, class: 'concepts_json_button mx-2') do
      render RoundedButtonComponent.new(id: 'classPermalink', link: 'javascript:void(0);', title: t('concepts.permanent_link_class'), data: { 'bs-toggle': "modal", 'bs-target': "#classPermalinkModal", current_purl: @current_purl }) do
        inline_svg_tag('icons/copy_link.svg', width: 20, height: 20)
      end
    end
  end

  def render_concepts_json_button(link)
    content_tag(:div, class: 'concepts_json_button') do
      render RoundedButtonComponent.new(link: link, target: '_blank', title: t('concepts.api_link_class'))
    end
  end

  def ontology_object_tabs_component(ontology_id:, objects_title:, object_id:, &block)
    resource_url = ontology_object_json_link(ontology_id, objects_title, object_id)
    render TabsContainerComponent.new(type: 'outline') do |c|
      concat(c.pinned_right do
        content_tag(:div, '', class: 'd-flex', 'data-concepts-json-target': 'button') do
          concat(render_permalink_link) if $PURL_ENABLED
          concat(render_concepts_json_button(resource_url))
        end
      end)

      capture(c, &block)
    end
  end

  def additional_details
    return '' if $ADDITIONAL_ONTOLOGY_DETAILS.nil? || $ADDITIONAL_ONTOLOGY_DETAILS[@ontology.acronym].nil?

    details = $ADDITIONAL_ONTOLOGY_DETAILS[@ontology.acronym]
    html = []
    details.each do |title, value|
      html << content_tag(:tr) do
        html << content_tag(:td, title)
        html << content_tag(:td, raw(value))
      end
    end
    html.join('')
  end

  def count_links(ont_acronym, page_name = 'summary', count = 0)
    ont_url = "/ontologies/#{ont_acronym}"
    if count.nil? || count.zero?
      return '0'
    else
      return "<a href='#{ont_url}/?p=#{page_name}'>#{number_with_delimiter(count, delimiter: ',')}</a>"
    end
  end

  def classes_link(ontology, count)
    return '0' if ontology.summaryOnly || count.nil? || count.zero?

    count_links(ontology.ontology.acronym, 'classes', count)
  end

  # Creates a link based on the status of an ontology submission
  def download_link(submission, ontology = nil)
    ontology ||= @ontology
    if submission.ontology.summaryOnly
      link = 'N/A - metadata only'
    else
      # Check if this is an OntoLex submission
      is_ontolex = submission.hasOntologyLanguage == 'ONTOLEX'
      
      uri = externalize_api_url(submission.id) + "/download?apikey=#{get_apikey}"
      link = "<a href='#{uri}' 'rel='nofollow'>#{is_ontolex ? 'ONTOLEX' : submission.pretty_format}</a>"
      latest = ontology.explore.latest_submission({ include_status: 'ready' })
      if latest && latest.submissionId == submission.submissionId && !is_ontolex
        link += " | <a href='#{externalize_api_url(ontology.id)}/download?apikey=#{get_apikey}&download_format=csv' rel='nofollow'>CSV</a>"
        if !latest.hasOntologyLanguage.eql?('UMLS')
          link += " | <a href='#{externalize_api_url(ontology.id)}/download?apikey=#{get_apikey}&download_format=rdf' rel='nofollow'>RDF/XML</a>"
        end
      end
      unless submission.diffFilePath.nil?
        uri = externalize_api_url(submission.id) + "/download_diff?apikey=#{get_apikey}"
        link = link + " | <a href='#{uri} 'rel='nofollow'>Diff</a>"
      end
    end
    link
  end

  def mappings_link(ontology, count)
    return '0' if ontology.summaryOnly || count.nil? || count.zero?

    count_links(ontology.ontology.acronym, 'mappings', count)
  end

  def notes_link(ontology, count)
    count_links(ontology.ontology.acronym, 'notes', count)
  end

  # Creates a link based on the status of an ontology submission
  def status_link(submission, latest = false, target = '')
    version_text = submission.version.nil? || submission.version.length == 0 ? 'unknown' : submission.version
    status_text = " <span class='ontology_submission_status'>" + submission_status2string(submission) + '</span>'
    if submission.ontology.summaryOnly || latest == false
      version_link = version_text
    else
      version_link = "<a href='/ontologies/#{submission.ontology.acronym}?p=classes' #{target.empty? ? '' : "target='#{target}'"}>#{version_text}</a>"
    end
    version_link + status_text
  end

  def new_view_link
    if session[:user].nil?
      link_to(login_index_path(redirect: new_ontology_path), { 'aria-label': 'Create view', title: 'Create view' }) do
        content_tag(:i, '', class: 'fas fa-lg fa-plus-circle', aria: { hidden: 'true' }).html_safe
      end
    else
      link_to(new_ontology_path, { 'aria-label': 'Create view', title: 'Create view' }) do
        content_tag(:i, '', class: 'fas fa-lg fa-plus-circle', aria: { hidden: 'true' }).html_safe
      end
    end
  end

  def submission_status2string(sub)
    # Massage the submission status into a UI string
    # submission status values, from:
    # https://github.com/ncbo/ontologies_linked_data/blob/master/lib/ontologies_linked_data/models/submission_status.rb
    # "UPLOADED", "RDF", "RDF_LABELS", "INDEXED", "METRICS", "ANNOTATOR", "ARCHIVED"  and 'ERROR_*' for each.
    # Strip the URI prefix from the status codes (works even if they are not URIs)
    # The order of the codes must be assumed to be random, it is not an entirely
    # predictable sequence of ontology processing stages.
    codes = sub.submissionStatus.map { |s| s.split('/').last }
    errors = codes.select { |c| c.start_with? 'ERROR' }.map { |c| c.gsub("_", " ").split(/(\W)/).map(&:capitalize).join }.compact
    status = []
    status.push('Parsed') if (codes.include? 'RDF') && (codes.include? 'RDF_LABELS')
    # The order of this array imposes an oder on the UI status code string
    status_list = ['INDEXED', 'METRICS', 'ANNOTATOR', 'ARCHIVED']
    status_list.insert(0, 'UPLOADED') unless status.include?('Parsed')
    status_list.each do |c|
      status.push(c.capitalize) if codes.include? c
    end
    status.concat errors
    return '' if status.empty?

    '(' + status.join(', ') + ')'
  end

  # Link for private/public/licensed ontologies
  def visibility_link(ontology)
    ont_url = "/ontologies/#{ontology.acronym}" # 'ontology' is NOT a submission here
    page_name = 'summary' # default ontology page view for visibility link
    link_name = 'Public' # default ontology visibility
    if ontology.summaryOnly
      link_name = 'Summary Only'
    elsif ontology.private?
      link_name = 'Private'
    elsif ontology.licensed?
      link_name = 'Licensed'
    end
    "<a href='#{ont_url}/?p=#{page_name}'>#{link_name}</a>"
  end

  def visits_data(ontology = nil)
    ontology ||= @ontology

    return nil unless @analytics && @analytics[ontology.acronym.to_sym]

    return @visits_data if @visits_data

    visits_data = { visits: [], labels: [] }
    years = @analytics[ontology.acronym.to_sym].to_h.keys.map { |e| e.to_s.to_i }.select { |e| e > 0 }.sort
    now = Time.now
    years.each do |year|
      months = @analytics[ontology.acronym.to_sym].to_h[year.to_s.to_sym].to_h.keys.map { |e| e.to_s.to_i }.select { |e| e > 0 }.sort
      months.each do |month|
        # No good data prior to Oct 2013
        next if now.year == year && now.month <= month || (year == 2013 && month < 10)

        visits_data[:visits] << @analytics[ontology.acronym.to_sym].to_h[year.to_s.to_sym][month.to_s.to_sym]
        visits_data[:labels] << DateTime.parse("#{year}/#{month}").strftime("%b %Y")
      end
    end
    @visits_data = visits_data
  end

  def acronyms(ontologies)
    ontologies.present? ? ontologies.map { |ont| ont.acronym } : []
  end

  def selected_section?(section_title)
    current_section.eql?(section_title)
  end

  def submission_ready?(submission)
    Array(submission&.submissionStatus).include?('RDF')
  end

  def concept_label_to_show(submission: @submission_latest)
    submission&.hasOntologyLanguage == 'SKOS' ? 'concepts' : 'classes'
  end

  def sections_to_show
    sections = ['summary']
    if !@ontology.summaryOnly && (submission_ready?(@submission_latest) || @old_submission_ready)
      if ontolex_ontology?
        sections += ['terminological_entries', 'forms', 'lexical_entries', 'lexical_senses', 'lexical_concepts']
      else
        sections += ['classes']
        sections += %w[properties]
        # sections += %w[schemes collections] if skos?
        # sections += %w[instances] unless skos?
        # sections += %w[notes mappings widgets sparql]
        sections += %w[notes mappings widgets]
      end
    end
    sections
  end

  def lazy_load_section(section_title, &block)
    if current_section.eql?(section_title)
      block.call
    else
      render TurboFrameComponent.new(id: section_title, src: "/ontologies/#{@ontology.acronym}?p=#{section_title}",
                                     loading: "lazy",
                                     target: '_top', data: { "turbo-frame-target": "frame" })
    end
  end

  def language_selector_hidden_tag(section)
    hidden_field_tag "language_selector_hidden_#{section}", '',
                     data: { controller: "language-change", 'language-change-section-value': section, action: "change->language-change#dispatchLangChangeEvent" }
  end

  def section_data(section_title)
    if ontology_data_section?(section_title)
      url_value = selected_section?(section_title) ? request.fullpath : "/ontologies/#{@ontology.acronym}?p=#{section_title}"
      { controller: "history turbo-frame", 'turbo-frame-url-value': url_value, action: "lang_changed->history#updateURL lang_changed->turbo-frame#updateFrame" }
    else
      {}
    end
  end

  def visits_chart_dataset(visits_data)
    visits_chart_dataset_array({ 'Visits': visits_data })
  end

  def visits_chart_dataset_array(visits_data, fill: true)
    visits_data = visits_data.map do |label, x|
      {
        label: label,
        data: x,
        borderWidth: 2,
        borderRadius: 5,
        borderSkipped: false,
        cubicInterpolationMode: 'monotone',
        tension: 0.4,
        fill: fill
      }
    end
    visits_data.to_json
  end

  def change_requests_enabled?(ontology_acronym)
    return false unless Rails.configuration.change_request[:ontologies].present?

    Rails.configuration.change_request[:ontologies].include? ontology_acronym.to_sym
  end

  def current_section
    (params[:p]) ? params[:p] : 'summary'
  end

  def ontology_data_sections
    LANGUAGE_FILTERABLE_SECTIONS
  end

  def ontology_data_section?(section_title = current_section)
    ontology_data_sections.include?(section_title)
  end

  def language_selector_tag(name)
    content_language_selector(id: name, name: name)
  end

  def submission_languages(submission = @submission)
    Array(submission&.naturalLanguage).map { |natural_language| natural_language.split('/').last }.compact
  end

  # OntoLex link helpers
  def get_link_for_ontolex_entity(entity_id, ont_acronym, entity_type, target = nil, style_as_badge = false)
    if entity_id.start_with?('http://') || entity_id.start_with?('https://')
      link = bp_ontolex_link(entity_id, ont_acronym, entity_type)
      ajax_url = "/ajax/ontolex/#{entity_type}/label?language=#{request_lang}"
      entity_url = "/ontologies/#{ont_acronym}?p=#{entity_type}&id=#{CGI.escape(entity_id)}"
      label_ajax_link(link, entity_id, ont_acronym, ajax_url, entity_url, target)
    else
      if style_as_badge
        render ChipButtonComponent.new(text: entity_id)
      else
        content_tag(:div, entity_id)
      end
    end
  end

  def bp_ontolex_link(entity_id, ont_acronym, entity_type)
    "/ontologies/#{ont_acronym}?p=#{entity_type}&id=#{CGI.escape(entity_id)}"
  end

  def ontolex_ontology?
    @ontology && @submission_latest && @submission_latest.hasOntologyLanguage == 'ONTOLEX'
  end

  # Generate OntoLex property translations as a JSON string for JavaScript
  # Dynamically extracts all available property translations from the locale file
  def ontolex_translations_json
    # Get all available property translations from the locale file
    begin
      properties_hash = I18n.t('ontology_details.ontolex.properties', raise: true)
      
      # If it's a hash, use the keys directly
      if properties_hash.is_a?(Hash)
        translations = properties_hash.transform_keys(&:to_s)
      else
        # Fallback to empty hash if something goes wrong
        translations = {}
      end
    rescue I18n::MissingTranslationData
      # Fallback: if translation keys are not found, return empty hash
      translations = {}
    end
    
    translations.to_json.html_safe
  end

  # Render all fields of an OntoLex entity automatically
  def render_ontolex_entity_fields(entity, ont_acronym)
    return '' unless entity.is_a?(Hash)

    # Fields to skip (internal or already displayed)
    skip_fields = ['@id', '@type', '@context', 'links', 'submission']
    
    # Map of field names to entity types for creating links
    entity_type_map = {
      'lexicalForm' => 'forms',
      'form' => 'forms',
      'sense' => 'lexical_senses',
      'lexicalSense' => 'lexical_senses',
      'isLexicalizedSenseOf' => 'lexical_concepts',
      'isSenseOf' => 'lexical_entries',
      'evokes' => 'lexical_concepts',
      'isEvokedBy' => 'lexical_entries',
      'signedForm' => 'signed_forms',
      'signedRep' => 'videos',
      'wasDerivedFrom' => 'references',
      'wasInfluencedBy' => 'activities',
      'hasDerivation' => 'agents',
      'definition' => 'definitions',
      'note' => 'notes',
      'usageExample' => 'usage_examples',
      'usage' => 'usages',
      'translation' => 'lexical_senses',
      'synonym' => 'lexical_senses'
    }

    html = []
    entity.each do |key, value|
      next if skip_fields.include?(key)
      next if value.nil? || (value.respond_to?(:empty?) && value.empty?)

      # Format the field label
      label = key.gsub(/([a-z])([A-Z])/, '\1 \2').capitalize
      
      # Render the value
      rendered_value = render_ontolex_field_value(value, key, entity_type_map[key], ont_acronym)
      
      html << content_tag(:div, class: 'ontolex-field') do
        content_tag(:strong, "#{label}: ", class: 'field-label') +
        content_tag(:span, rendered_value.html_safe, class: 'field-value')
      end
    end

    html.join("\n").html_safe
  end

  private

  def render_ontolex_field_value(value, field_name, entity_type, ont_acronym)
    if value.is_a?(Array)
      # Array of values
      value.map { |v| render_single_ontolex_value(v, field_name, entity_type, ont_acronym) }.join(', ')
    else
      render_single_ontolex_value(value, field_name, entity_type, ont_acronym)
    end
  end

  def render_single_ontolex_value(value, field_name, entity_type, ont_acronym)
    if value.is_a?(Hash) && value['@id']
      # It's a reference to another entity
      label = value['label'] || value['prefLabel'] || value['writtenRep'] || extract_id_fragment(value['@id'])
      if entity_type
        link_to(label, bp_ontolex_link(value['@id'], ont_acronym, entity_type), 
                class: 'ontolex-entity-link btn btn-sm btn-outline-primary', 
                data: { turbo: 'false' })
      else
        content_tag(:span, label, class: 'ontolex-value')
      end
    elsif value.is_a?(String) && value.start_with?('http://', 'https://')
      # It's a URI
      if entity_type
        # It's a reference that should be linkable
        label = extract_id_fragment(value)
        link_to(label, bp_ontolex_link(value, ont_acronym, entity_type), 
                class: 'ontolex-entity-link btn btn-sm btn-outline-primary', 
                data: { turbo: 'false' })
      else
        # It's just a URI value
        link_to(value, value, target: '_blank', class: 'external-link')
      end
    else
      # Simple value
      h(value.to_s)
    end
  end

  def extract_id_fragment(uri)
    # Extract the last part of the URI as a label
    uri.to_s.split(/[#\/]/).last || uri.to_s
  end
end
