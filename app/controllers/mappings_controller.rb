# frozen_string_literal: true

require 'cgi'

class MappingsController < ApplicationController
  include ActionView::Helpers::NumberHelper
  include MappingStatistics,MappingsHelper

  layout :determine_layout
  before_action :authorize_and_redirect, only: [:create, :new, :destroy]

  MAPPINGS_URL = "#{LinkedData::Client.settings.rest_url}/mappings"

  def index
    ontology_list = LinkedData::Client::Models::Ontology.all.select { |o| !o.summaryOnly }
    ontologies_mapping_count = LinkedData::Client::HTTP.get("#{MAPPINGS_URL}/statistics/ontologies")
    ontologies_hash = {}
    ontology_list.each do |ontology|
      ontologies_hash[ontology.acronym] = ontology
    end

    # TODO_REV: Views support for mappings
    # views_list.each do |view|
    #   ontologies_hash[view.ontologyId] = view
    # end

    @options = {}
    if ontologies_mapping_count
      ontologies_mapping_count.members.each do |ontology_acronym|
        ontology = ontologies_hash[ontology_acronym.to_s]
        next if ontology.nil?

        mapping_count = ontologies_mapping_count[ontology_acronym]
        next if mapping_count.nil? || mapping_count.to_i.zero?

        select_text = "#{ontology.name} - #{ontology.acronym} (#{number_with_delimiter(mapping_count, delimiter: ',')})"
        @options[select_text] = ontology_acronym
      end
    end

    @options = @options.sort
  end

  def count
    @ontology = LinkedData::Client::Models::Ontology.find_by_acronym(params[:id]).first

    if is_ontolex_format?(@ontology)
      page = params[:page] || 1
      size = params[:pagesize] || 50
      response = LinkedData::Client::HTTP.get(
        "/ontologies/#{@ontology.acronym}/mappings",
        { page: page, pagesize: size }
      )
      @ontolex_mappings = response&.collection || []
      @ontolex_total    = response&.totalCount || 0
      @ontolex_page     = response&.page || 1
      @ontolex_pages    = response&.pageCount || 1
      render partial: 'ontolex_mappings', layout: false
    else
      @mapping_counts = mapping_counts(@ontology.acronym)
      render partial: 'count'
    end
  end

  def show
    @ontology = LinkedData::Client::Models::Ontology.find_by_acronym(params[:id]).first
    not_found if @ontology.nil?

    @target_ontology = LinkedData::Client::Models::Ontology.find(params[:target])
    not_found if @target_ontology.nil?

    page = params[:page] || 1

    if is_ontolex_format?(@ontology) || is_ontolex_format?(@target_ontology)
      size = params[:pagesize] || 50
      response = LinkedData::Client::HTTP.get(
        "/ontologies/#{@ontology.acronym}/mappings",
        { page: page, pagesize: size }
      )
      @ontolex_mappings = response&.collection || []
      @ontolex_total    = response&.totalCount || 0
      @ontolex_page     = response&.page || 1
      @ontolex_pages    = response&.pageCount || 1
      render partial: 'ontolex_mappings', layout: false
      return
    end

    ontologies = [@ontology.acronym, @target_ontology.acronym]
    @mapping_pages = LinkedData::Client::HTTP.get(MAPPINGS_URL,
                                                  { page: page, ontologies: ontologies.join(',') })
    @mappings = @mapping_pages.collection
    @delete_mapping_permission = check_delete_mapping_permission(@mappings)

    if @mapping_pages.nil? || @mapping_pages.collection.empty?
      @mapping_pages = MappingPage.new
      @mapping_pages.page = 1
      @mapping_pages.pageCount = 1
      @mapping_pages.collection = []
    end

    total_results = @mapping_pages.pageCount * @mapping_pages.collection.length

    # This converts the mappings into an object that can be used with the pagination plugin
    @page_results = WillPaginate::Collection.create(@mapping_pages.page,
                                                    @mapping_pages.collection.length, total_results) do |pager|
      pager.replace(@mapping_pages.collection)
    end

    render partial: 'show'
  end

   def get_concept_table
    @ontology = LinkedData::Client::Models::Ontology.find_by_acronym(params[:ontologyid]).first
    @type = params[:type]

    if is_ontolex_format?(@ontology)
      concept_id = CGI.unescape(params[:conceptid].to_s)
      page = params[:page] || 1
      size = params[:pagesize] || 50
      response = LinkedData::Client::HTTP.get(
        "/ontologies/#{@ontology.acronym}/lexical_concepts/#{CGI.escape(concept_id)}/mappings",
        { page: page || 1, pagesize: size || 50 }
      )
      @mappings = response&.collection || []
      @ontolex_mappings = true
    else
      @concept = get_concept_or_entry(@ontology, params[:conceptid])
      @mappings = get_concept_mappings(@concept)
    end

    @delete_mapping_permission = check_delete_mapping_permission(@mappings)
    render partial: 'mappings/concept_mappings', layout: false
  end

  def new
    @ontology_from = LinkedData::Client::Models::Ontology.find(params[:ontology_from])
    @ontology_to = LinkedData::Client::Models::Ontology.find(params[:ontology_to])
    @concept_from = get_concept_or_entry(@ontology_from, params[:conceptid_from]) if @ontology_from
    @concept_to = get_concept_or_entry(@ontology_to, params[:conceptid_to]) if @ontology_to

    # Defaults just in case nothing gets provided
    @ontology_from ||= LinkedData::Client::Models::Ontology.new
    @ontology_to ||= LinkedData::Client::Models::Ontology.new
    @concept_from ||= LinkedData::Client::Models::Class.new
    @concept_to ||= LinkedData::Client::Models::Class.new

    @mapping_relation_options = [
      ['Identical (skos:exactMatch)', 'http://www.w3.org/2004/02/skos/core#exactMatch'],
      ['Similar (skos:closeMatch)',   'http://www.w3.org/2004/02/skos/core#closeMatch'],
      ['Related (skos:relatedMatch)', 'http://www.w3.org/2004/02/skos/core#relatedMatch'],
      ['Broader (skos:broadMatch)',   'http://www.w3.org/2004/02/skos/core#broadMatch'],
      ['Narrower (skos:narrowMatch)', 'http://www.w3.org/2004/02/skos/core#narrowMatch']
    ]

    respond_to do |format|
      format.js
    end
  end

  # POST /mappings
  # POST /mappings.xml
  def create
    source_ontology = LinkedData::Client::Models::Ontology.find_by_acronym(params[:map_from_bioportal_ontology_id]).first
    target_ontology = LinkedData::Client::Models::Ontology.find_by_acronym(params[:map_to_bioportal_ontology_id]).first
    source = source_ontology.explore.single_class(params[:map_from_bioportal_full_id])
    target = target_ontology.explore.single_class(params[:map_to_bioportal_full_id])
    values = {
      classes: {
        source.id => source_ontology.id,
        target.id => target_ontology.id
      },
      creator: session[:user].id,
      relation: params[:mapping_relation],
      comment: params[:mapping_comment]
    }
    @mapping = LinkedData::Client::Models::Mapping.new(values: values)
    @mapping_saved = @mapping.save
    if @mapping_saved.errors
      raise Exception, @mapping_saved.errors
    else
      @delete_mapping_permission = check_delete_mapping_permission(@mapping_saved)
      render json: @mapping_saved
    end
  end

  def destroy
    errors = []
    successes = []
    mapping_ids = params[:mappingids].split(',')
    mapping_ids.each do |map_id|
      begin
        map_uri = "#{MAPPINGS_URL}/#{CGI.escape(map_id)}"
        result = LinkedData::Client::HTTP.delete(map_uri)
        raise Exception if !result.nil? # && result["errorCode"]

        successes << map_id
      rescue Exception => e
        errors << map_id
      end
    end
    render json: { success: successes, error: errors }
  end
  
  private
  
  # Get a concept (class) or lexical entry depending on the ontology format
  def get_concept_or_entry(ontology, concept_id)
    return nil unless ontology
    
    # Check if this is an OntoLex ontology
    if is_ontolex_format?(ontology)
      # For OntoLex, try to get as lexical entry first
      get_lexical_entry(ontology, concept_id)
    else
      # Regular ontology - use single_class
      ontology.explore.single_class({ full: true }, concept_id)
    end
  end
  
  def is_ontolex_format?(ontology)
    return false unless ontology
    
    submission = ontology.explore.latest_submission rescue nil
    return false unless submission
    
    ont_language = submission.hasOntologyLanguage rescue nil
    return false unless ont_language
    
    ont_language_id = ont_language.respond_to?(:id) ? ont_language.id.to_s : ont_language.to_s
    ont_language_id.include?('ONTOLEX') || ont_language_id == 'ONTOLEX'
  end
  
  def get_lexical_entry(ontology, entry_id)
    # Use the lexical_entries endpoint directly via HTTP
    acronym = ontology.acronym
    encoded_id = CGI.escape(entry_id)
    result = LinkedData::Client::HTTP.get("/ontologies/#{acronym}/lexical_entries/#{encoded_id}")
    result
  end
end