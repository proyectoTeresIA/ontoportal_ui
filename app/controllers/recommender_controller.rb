class RecommenderController < ApplicationController
  layout :determine_layout

  # REST_URI is defined in application_controller.rb
  RECOMMENDER_URI = "/recommender"

  def index
  end

  # def create
  #   # Parse params (default values are set at the service level)
  #   input = params[:input].strip.gsub("\r\n", " ").gsub("\n", " ")
  #   start = Time.now
  #   query = RECOMMENDER_URI
  #   query += "?input=" + CGI.escape(input)
  #   query += "&ontologies=" + CGI.escape(params[:ontologies].join(',')) unless params[:ontologies].nil?
  #   query += "&input_type=" + params[:input_type] unless params[:input_type].nil?
  #   query += "&output_type=" + params[:output_type] unless params[:output_type].nil?
  #   query += "&max_elements_set=" + params[:max_elements_set] unless params[:output_type].nil?
  #   query += "&wc=" + params[:wc].to_s unless params[:wc].nil?
  #   query += "&ws=" + params[:ws].to_s unless params[:ws].nil?
  #   query += "&wa=" + params[:wa].to_s unless params[:wa].nil?
  #   query += "&wd=" + params[:wd].to_s unless params[:wd].nil?
  #   recommendations = parse_json(query) # See application_controller.rb
  #   LOG.add :debug, "Retrieved #{recommendations.length} recommendations: #{Time.now - start}s"
  #   render :json => recommendations
  # end

  # NOTE: this call (POST) works at a local environment but not in staging
  def create
    start = Time.now
    input = params[:input].strip.gsub("\r\n", " ").gsub("\n", " ")
    # Default values are set at the service level)
    form_data = Hash.new
    form_data['input'] = input
    form_data['ontologies'] = params[:ontologies].join(',') unless params[:ontologies].nil?
    form_data['input_type'] = params[:input_type] unless params[:input_type].nil?
    form_data['output_type'] = params[:output_type] unless params[:output_type].nil?
    form_data['max_elements_set'] = params[:max_elements_set] unless params[:output_type].nil?
    form_data['wc'] = params[:wc].to_s unless params[:wc].nil?
    form_data['ws'] = params[:ws].to_s unless params[:ws].nil?
    form_data['wa'] = params[:wa].to_s unless params[:wa].nil?
    form_data['wd'] = params[:wd].to_s unless params[:wd].nil?
    recommendations = LinkedData::Client::HTTP.post(RECOMMENDER_URI, form_data, raw: true)
    if recommendations.is_a?(String)
      begin
        recommendations = JSON.parse(recommendations)
      rescue JSON::ParserError
        recommendations = []
      end
    end
    if recommendations.respond_to?(:empty?) && recommendations.empty?
      recommendations = ontolex_fallback_recommendations(input, params[:ontologies])
    end
    Log.add :debug, "Retrieved #{recommendations.length} recommendations: #{Time.now - start}s"
    render json: recommendations
  end

  private

  def ontolex_fallback_recommendations(input, ontologies)
    words = input.to_s.downcase.scan(/\p{L}[\p{L}\p{N}_-]*/u).uniq.select { |w| w.length >= 3 }
    return [] if words.empty?

    target_acronyms = Array(ontologies).map(&:to_s).reject(&:empty?)
    scores = Hash.new { |h, k| h[k] = { hits: 0, annotations: [] } }

    words.each do |word|
      query = "#{REST_URI}/search?q=#{CGI.escape(word)}&resource_type=form"
      query += "&ontologies=#{CGI.escape(target_acronyms.join(','))}" unless target_acronyms.empty?

      begin
        results = parse_json(query)
      rescue => e
        Log.add :debug, "Recommender fallback search failed for '#{word}': #{e.message}"
        next
      end

      collection = (results || {})['collection'] || []
      collection.each do |form|
        ontology_uri = form.dig('links', 'ontology').to_s
        acronym = ontology_uri.split('/').last
        next if acronym.nil? || acronym.empty?

        scores[acronym][:hits] += 1
        from_idx = input.to_s.downcase.index(word)
        from_pos = from_idx ? from_idx + 1 : 1
        to_pos = from_idx ? from_idx + word.length : word.length
        scores[acronym][:annotations] << {
          'text' => word,
          'from' => from_pos,
          'to' => to_pos,
          'annotatedClass' => {
            '@id' => Array(form['lexicalEntries']).first || form['@id'],
            'links' => {
              'ui' => "/ontologies/#{acronym}?p=terminological_entries",
              'ontology' => ontology_uri
            }
          }
        }
      end
    end

    max_hits = scores.values.map { |v| v[:hits] }.max.to_f
    return [] if max_hits <= 0

    scores.map do |acronym, data|
      normalized = data[:hits] / max_hits
      {
        'ontologies' => [{ 'acronym' => acronym }],
        'evaluationScore' => normalized,
        'coverageResult' => {
          'normalizedScore' => normalized,
          'annotations' => data[:annotations].uniq { |a| [a['text'], a.dig('annotatedClass', 'links', 'ui')] }
        },
        'acceptanceResult' => { 'normalizedScore' => 0.0 },
        'detailResult' => { 'normalizedScore' => 0.0 },
        'specializationResult' => { 'normalizedScore' => 0.0 }
      }
    end.sort_by { |r| -r['evaluationScore'] }
  end

end
