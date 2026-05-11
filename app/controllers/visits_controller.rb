class VisitsController < ApplicationController

  layout :determine_layout

  def index
    @ontologies_views = LinkedData::Client::Models::Ontology.all(include_views: true)
    @ontologies_views = [] unless @ontologies_views.respond_to?(:each)
    @ontologies = @ontologies_views.select { |o| o.respond_to?(:viewOf) && !o.viewOf }
    @ontologies_hash = @ontologies_views.each_with_object({}) do |o, acc|
      next unless o.respond_to?(:acronym)
      acc[o.acronym] = o
    end
    @analytics = LinkedData::Client::Analytics.last_month
  end

end
