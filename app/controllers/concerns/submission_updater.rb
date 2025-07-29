module SubmissionUpdater
  extend ActiveSupport::Concern

  def submission_from_params(new_submission_hash)
    convert_values_to_types(new_submission_hash)
    LinkedData::Client::Models::OntologySubmission.new(values: submission_params(new_submission_hash))
  end
  def save_submission(new_submission_hash)
    @submission = submission_from_params(new_submission_hash)

    update_ontology_summary_only
    @submission.save(cache_refresh_all: false)
  end

  def update_submission(new_submission_hash, submission_id , ontology = nil)

    convert_values_to_types(new_submission_hash)

    @ontology = ontology || LinkedData::Client::Models::Ontology.find_by_acronym(new_submission_hash[:ontology]).first
    new_submission_hash.delete(:ontology)

    @submission = @ontology.explore.submissions({ include: 'all' }, submission_id)

    new_values = new_submission_hash
    new_values.each do |key, values|
      @submission.send("#{key}=", values)
    rescue StandardError
      next
    end

    update_ontology_summary_only
    [@submission, @submission.update(values: new_values, cache_refresh_all: false)]
  end

  def add_ontologies_to_object(ontologies,object)
    ontologies.each do |ont|
      next if object.ontologies.include?(ont)
      ontology = LinkedData::Client::Models::Ontology.find(ont)
      if object.type.match(/\/([^\/]+)$/)[1] == 'Group'
        ontology.group.push(object.id)
      else
        ontology.hasDomain.push(object.id)
      end
      ontology.update
    end
  end

  def delete_ontologies_from_object(new_ontologies,old_ontologies,object)
    new_ontologies = [] if new_ontologies.nil?
    ontologies = old_ontologies - new_ontologies
    ontologies.each do |ont|
      ontology = LinkedData::Client::Models::Ontology.find(ont)
      if object.type.match(/\/([^\/]+)$/)[1] == 'Group'
        ontology.group.delete(object.id)
      else
        ontology.hasDomain.delete(object.id)
      end
      ontology.update
    end
  end

  private

  def update_ontology_summary_only(is_remote = @submission.isRemote)
    if is_remote && @ontology.summaryOnly != is_remote.eql?('3')
      @ontology.update(values: {summaryOnly: is_remote.eql?('3')}, cache_refresh_all: false)
    end
  end

  def convert_values_to_types(new_submission_hash)
    unless new_submission_hash[:contact].nil?
      # Additional processing if needed - most processing now done in submission_params
      if new_submission_hash[:contact].is_a?(Array)
        new_submission_hash[:contact].delete_if { |c| c[:name].blank? || c[:email].blank? }
      end
    end

    # Convert metadata that needs to be integer to int
    submission_metadata.map do |hash|
      if hash["enforce"].include?("integer")
        if !new_submission_hash[hash["attribute"]].nil? && !new_submission_hash[hash["attribute"]].eql?("")
          new_submission_hash[hash["attribute"].to_s.to_sym] = Integer(new_submission_hash[hash["attribute"].to_s.to_sym])
        end
      end
      if hash["enforce"].include?("boolean") && !new_submission_hash[hash["attribute"]].nil?
        if new_submission_hash[hash["attribute"]].eql?("true")
          new_submission_hash[hash["attribute"].to_s.to_sym] = true
        elsif new_submission_hash[hash["attribute"]].eql?("false")
          new_submission_hash[hash["attribute"].to_s.to_sym] = false
        else
          new_submission_hash[hash["attribute"].to_s.to_sym] = nil
        end
      end
    end
  end


  def submission_params(params)
    # Extract submission parameters from the nested structure
    submission_params = if params.is_a?(ActionController::Parameters) && params[:submission]
                          params[:submission]
                        else
                          params
                        end
    
    attributes = [
      :ontology,
      :description,
      :hasOntologyLanguage,
      :prefLabelProperty,
      :synonymProperty,
      :definitionProperty,
      :authorProperty,
      :obsoleteProperty,
      :obsoleteParent,
      :version,
      :status,
      :released,
      :isRemote,
      :pullLocation,
      :filePath,
      { contact: [:name, :email] },
      :homepage,
      :documentation,
      :publication,
      {copyrightHolder: {}} # TODO add automatically no list Agents
    ]

    submission_metadata.each do |m|
      m_attr = m["attribute"].to_sym
      m_attr =  Array(m["enforce"]).include?("list") ? [{ m_attr => {} }, { m_attr => []}] : m_attr
      attributes << m_attr
    end
    p = submission_params.permit(attributes.uniq)
    p['pullLocation'] = '' if p['isRemote']&.eql?('3')

    if p[:contact].is_a?(Hash) && p[:contact].key?('NEW_RECORD')
      contact_data = p[:contact]['NEW_RECORD']
      if contact_data.is_a?(Hash) && contact_data['name'].present? && contact_data['email'].present?
        p[:contact] = [contact_data.with_indifferent_access]
      else
        p[:contact] = []
      end
    end

    p = p.to_h.transform_values do |v|
      if v.is_a? Hash
        v.values.reject(&:empty?)
      elsif v.is_a? Array
        v.reject(&:empty?)
      else
        v
      end
    end

    if p["copyrightHolder"]&.first&.include?("id") # TODO automatize
      p["copyrightHolder"] = p["copyrightHolder"].first["id"]
    elsif p["copyrightHolder"]
      p["copyrightHolder"] = ''
    end


    submission_metadata.each do |m|
      m_attr = m['attribute'].to_sym
      if p[m_attr] && m['enforce'].include?('list')
        p[m_attr] = Array(p[m_attr]) unless p[m_attr].is_a?(Array)
        p[m_attr] = p[m_attr].map { |x| x.is_a?(Hash) ? x.values.reject(&:empty?) : x.reject(&:empty?) }.flatten.uniq if m['enforce'].include?('Agent')
      end
    end

    p
  end
end
