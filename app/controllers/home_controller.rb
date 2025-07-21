# frozen_string_literal: true

require 'ostruct'

class HomeController < ApplicationController
  layout :determine_layout

  def index
    begin
      @ontologies_views = LinkedData::Client::Models::Ontology.all(include_views: true)
      # If the API returns a hash instead of an array, treat it as an empty array
      @ontologies_views = [] if @ontologies_views.is_a?(Hash)
    rescue StandardError => e
      Rails.logger.error "Error fetching ontologies: #{e.message}"
      @ontologies_views = []
    end

    @ontologies = @ontologies_views.select { |o| !o.viewOf }
    @ontologies_hash = Hash[@ontologies_views.map { |o| [o.acronym, o] }]

    begin
      @groups = LinkedData::Client::Models::Group.all
      @groups = [] if @groups.is_a?(Hash)
    rescue StandardError => e
      Rails.logger.error "Error fetching groups: #{e.message}"
      @groups = []
    end
    organize_groups

    # Calculate BioPortal summary statistics
    @ont_count = @ontologies.length

    begin
      metrics = LinkedData::Client::Models::Metrics.all
      metrics = [] if metrics.is_a?(Hash)
      @cls_count = metrics.map { |m| m.classes.to_i }.sum
    rescue StandardError => e
      Rails.logger.error "Error fetching metrics: #{e.message}"
      @cls_count = 0
    end

    @prop_count = 36_286
    @map_count = total_mapping_count

    begin
      @analytics = LinkedData::Client::Analytics.last_month
      @analytics = OpenStruct.new(onts: []) if @analytics.is_a?(Hash)
    rescue StandardError => e
      Rails.logger.error "Error fetching analytics: #{e.message}"
      @analytics = OpenStruct.new(onts: [])
    end

    @ontology_names = @ontologies.map { |ont| ["#{ont.name} (#{ont.acronym})", ont.acronym] }

    @anal_ont_names = {}
    @anal_ont_numbers = []

    return unless @analytics.respond_to?(:onts) && @analytics.onts.is_a?(Array)

    @analytics.onts[0..4].each do |visits|
      next unless visits.is_a?(Hash) && visits[:ont] && visits[:views]

      ont = @ontologies_hash[visits[:ont].to_s]
      next unless ont

      @anal_ont_names[ont.acronym] = ont.name
      @anal_ont_numbers << visits[:views]
    end
  end

  def render_layout_partial
    partial = params[:partial]
    render partial: "layouts/#{partial}"
  end

  def help
    # Show the header/footer or not
    layout = params[:pop].eql?('true') ? 'popup' : 'ontology'
    render layout: layout
  end

  def all_resources
    @conceptid = params[:conceptid]
    @ontologyid = params[:ontologyid]
    @ontologyversionid = params[:ontologyversionid]
    @search = params[:search]
  end

  def feedback
    # Show the header/footer or not
    feedback_layout = params[:pop].eql?('true') ? 'popup' : 'ontology'

    # We're using a hidden form field to trigger for error checking
    # If sim_submit is nil, we know the form hasn't been submitted and we should
    # bypass form processing.
    if params[:sim_submit].nil?
      render layout: feedback_layout
      return
    end

    @errors = []

    @errors << 'Please include your name' if params[:name].nil? || params[:name].empty?
    if params[:email].nil? || params[:email].length < 1 || !params[:email].match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i)
      @errors << 'Please include your email'
    end
    @errors << 'Please include your comment' if params[:comment].nil? || params[:comment].empty?
    if using_captcha? && !session[:user] && !verify_recaptcha
      @errors << 'Please fill in the proper text from the supplied image'
    end

    unless @errors.empty?
      render layout: feedback_layout
      return
    end

    Notifier.feedback(params[:name], params[:email], params[:comment], params[:location]).deliver_now

    if params[:pop].eql?('true')
      render 'feedback_complete', layout: 'popup'
    else
      flash[:notice] = 'Feedback has been sent'
      redirect_to_home
    end
  end

  def site_config
    render json: bp_config_json
  end

  def feedback_complete; end

  def validate_ontology_file_show; end

  def validate_ontology_file
    response = LinkedData::Client::HTTP.post('/validate_ontology_file', ontology_file: params[:ontology_file])
    @process_id = response.process_id
  end

  private

  # Dr. Musen wants 5 specific groups to appear first, sorted by order of importance.
  # Ordering is documented in GitHub: https://github.com/ncbo/bioportal_web_ui/issues/15.
  # All other groups come after, with agriculture in the last position.
  def organize_groups
    # Reference: https://lildude.co.uk/sort-an-array-of-strings-by-severity
    acronyms = %w[UMLS OBO_Foundry WHO-FIC CTSA caBIG]
    size = @groups.size
    @groups.sort_by! { |g| acronyms.find_index(g.acronym[/(UMLS|OBO_Foundry|WHO-FIC|CTSA|caBIG)/]) || size }

    others, agriculture = @groups.partition { |g| g.acronym != 'CGIAR' }
    @groups = others + agriculture
  end
end
