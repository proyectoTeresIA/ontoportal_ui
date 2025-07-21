# Make sure it matches the Ruby version in .ruby-version and Gemfile
ARG RUBY_VERSION=3.2
FROM ruby:${RUBY_VERSION}-slim-bookworm

WORKDIR /app

RUN bash -c "set -o pipefail && apt-get update && \
  apt-get install -y --no-install-recommends \
     build-essential \
     libxml2 \
     libxslt-dev \
     libmariadb-dev \
     libyaml-dev \
     git \
     curl \
  && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o /etc/apt/keyrings/nodesource.asc \
  && echo 'deb [signed-by=/etc/apt/keyrings/nodesource.asc] https://deb.nodesource.com/node_20.x nodistro main' | tee /etc/apt/sources.list.d/nodesource.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends nodejs \
  && corepack enable \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /usr/share/doc /usr/share/man \
  && mkdir /node_modules"

ARG RAILS_ENV="production"
ARG NODE_ENV="production"
ARG BUNDLE_WITHOUT="development test"

ENV RAILS_LOG_TO_STDOUT="1" \
    RAILS_SERVE_STATIC_FILES="true" \
    RAILS_ENV="${RAILS_ENV}" \
    NODE_ENV="${NODE_ENV}" \
    BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_WITHOUT="${BUNDLE_WITHOUT}"

#PATH="${PATH}:/node_modules/.bin"
COPY Gemfile* .
RUN bundle install

COPY package.json *yarn* ./
RUN yarn install

COPY . .

RUN if [ ! -f config/bioportal_config_production.rb ]; then \
    cp config/bioportal_config_env.rb.sample config/bioportal_config_production.rb; \
  fi \
 && if [ ! -f config/bioportal_config_development.rb ]; then \
    cp config/bioportal_config_env.rb.sample config/bioportal_config_development.rb; \
  fi \
 && if [ ! -f config/bioportal_config_test.rb ]; then \
    cp config/bioportal_config_env.rb.sample config/bioportal_config_test.rb; \
  fi \
 && if [ ! -f config/database.yml ]; then \
    cp config/database.yml.sample config/database.yml; \
  fi

RUN if [ "${RAILS_ENV}" != "development" ]; then \
  bundle exec bootsnap precompile --gemfile app/ lib/ && \
  SECRET_KEY_BASE_DUMMY=1 \
  NEW_RELIC_LICENSE_KEY=dummy \
  NEW_RELIC_APP_NAME="Build Process" \
  ./bin/rails assets:precompile && \
  bundle install --deployment --without development test; fi

RUN mkdir -p /var/log/ontoportal/ui /run/puma-ui

EXPOSE 3000

CMD ["./bin/rails", "server"]
