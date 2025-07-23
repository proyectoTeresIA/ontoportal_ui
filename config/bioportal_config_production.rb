# Organization info
$ORG = ENV['ORG'] || 'NCBO'
$ORG_URL = ENV['ORG_URL'] || 'https://www.bioontology.org'

# Site name (required)
$SITE = ENV['SITE'] || 'BioPortal'

# Full string for site, EX: "NCBO BioPortal", do not modify
$ORG_SITE = $ORG.nil? || $ORG.empty? ? $SITE : "#{$ORG} #{$SITE}"

# The URL for the BioPortal Rails UI (this application)
$UI_URL = ENV['UI_URL'] || 'http://localhost:3000'

# If you are running a PURL server to provide URLs for ontologies in your BioPortal instance, enable this option
$PURL_ENABLED = ENV['PURL_ENABLED'] || false
# The PURL URL is generated using this prefix + the abbreviation for an ontology.
# The PURL URL generation algorithm can be altered in app/models/ontology_wrapper.rb
$PURL_PREFIX = ENV['PURL_PREFIX'] || 'https://purl.bioontology.org/ontology'

# Unique string representing the UI's id for use with the BioPortal Core
$API_KEY = ENV['API_KEY']

# BioPortal API service address
$REST_URL = ENV['API_URL']

$NOT_DOWNLOADABLE = {}

# Release version text (appears in footer of all pages, except 404 and 500 errors)
$RELEASE_VERSION = ENV['RELEASE_VERSION']

# Enable Slices, filtering of ontologies based on subdomain and ontology groups
$ENABLE_SLICES = ENV['ENABLE_SLICES'] || false

# A user id for user 'anonymous' for use when a user is required for an action on the REST service but you don't want to require a user to login
$ANONYMOUS_USER = 0

# Enable client request caching
$CLIENT_REQUEST_CACHING = true

# Enable debugging of API Ruby client
$DEBUG_RUBY_CLIENT = ENV['DEBUG_RUBY_CLIENT'] || false
# When DEBUG_RUBY_CLIENT is true, this array can limit the cache keys for which to receive debug output. Empty array means output debugging info for ALL keys
$DEBUG_RUBY_CLIENT_KEYS = ENV['DEBUG_RUBY_CLIENT_KEYS'] || []

# Email settings
ActionMailer::Base.smtp_settings = {
  address: '', # smtp server address, ex: smtp.example.org
  port: 25, # smtp server port
  domain: '' # fqdn of rails server, ex: rails.example.org
}

# Announcements mailman mailing list REQUEST address, EX: list-request@lists.example.org
# NOTE: You must use the REQUEST address for the mailing list. ONLY WORKS WITH MAILMAN LISTS.
$ANNOUNCE_LIST = ENV['SUPPORT_EMAIL'] || 'bioportal-test-announce@example.org'
# Email addresses used for sending notifications (errors, feedback, support)
$SUPPORT_EMAIL = ENV['SUPPORT_EMAIL'] || 'bioportal-test-support@example.org'

# reCAPTCHA
# In order to use reCAPTCHA on the account creation and feedback submission pages:
#    1. Obtain a reCAPTCHA v2 key from: https://www.google.com/recaptcha/admin
#    2. Put the site and secret keys in the encrypted credentials file:
#
#       recaptcha:
#         site_key: your_site_key
#         secret_key: your_secret_key
#
#    3. Set the USE_RECAPTCHA option to 'true'
ENV['USE_RECAPTCHA'] = 'false'

# Memcached servers
# ENV['MEMCACHE_SERVERS'] = 'localhost'

# Custom BioPortal logging
require 'log'

# URL where BioMixer GWT app is located
$BIOMIXER_URL = ENV['BIOMIXER_URL'] || 'http://localhost:8081/BioMixer'
$BIOMIXER_APIKEY = ENV['BIOMIXER_APIKEY']

##
# Custom Ontology Details
# Custom details can be added on a per ontology basis using a key/value pair as columns of the details table
#
# Example:
# $ADDITIONAL_ONTOLOGY_DETAILS = { "STY" => { "Additional Detail" => "Text to be shown in the right-hand column." } }
##
$ADDITIONAL_ONTOLOGY_DETAILS = {}

# Front notice appears on the front page only and is closable by the user. It remains closed for seven days (stored in cookie)
$FRONT_NOTICE = ''
# Site notice appears on all pages and remains closed indefinitely. Stored below as a hash with a unique key and a string message
# EX: $SITE_NOTICE = { :unique_key => 'Put your message here (can include <a href="/link">html</a> if you use single quotes).' }
$SITE_NOTICE = {}

$UI_THEME = ENV['UI_THEME'] || 'bioportal'

# Production-specific configuration
$HOSTNAME = ENV['HOSTNAME'] || 'localhost'

# The URL for the BioPortal Rails UI (this application)
$UI_URL = ENV['UI_URL'] || "http://#{$HOSTNAME}:3000"

# REST core service address - using ENV['API_URL'] from environment
$SPARQL_URL = ENV['SPARQL_URL'] || "http://#{$HOSTNAME}:8081/test/"

# BioMixer URL
$BIOMIXER_URL = ENV['BIOMIXER_URL'] || "http://#{$HOSTNAME}:8081/BioMixer"

# Annotator and Proxy URLs
$ANNOTATOR_URL = ENV['ANNOTATOR_URL'] || "http://#{$HOSTNAME}:8081/annotator"
$PROXY_URL = ENV['PROXY_URL'] || $ANNOTATOR_URL

# If your BioPortal installation includes Fairness score set this to true
$FAIRNESS_DISABLED = ENV['FAIRNESS_DISABLED'] || false
$FAIRNESS_URL = ENV['FAIRNESS_URL'] || "http://#{$HOSTNAME}:8081/fairness"

# NCBO annotator URL and apikey
$NCBO_ANNOTATOR_URL = ENV['NCBO_ANNOTATOR_URL'] || "http://#{$HOSTNAME}:8081/ncbo_annotatorplus"
$NCBO_ANNOTATORPLUS_ENABLED = ENV['NCBO_ANNOTATORPLUS_ENABLED'] || true
$NCBO_API_KEY = ENV['NCBO_API_KEY'] || '4a5011ea-75fa-4be6-8e89-f45c8c84844e'

$NOT_DOWNLOADABLE = []
