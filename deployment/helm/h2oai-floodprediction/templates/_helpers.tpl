{{- define "h2oai-floodprediction.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "h2oai-floodprediction.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
   Create a Client Secret for NVIDIA API Key
*/}}
{{- define "h2oai-floodprediction.nvidiaApiKey" -}}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace (printf "%s-secrets" .Release.Name)) -}}
{{- if .Values.nvidia.apiKey -}}
{{- .Values.nvidia.apiKey -}}
{{- else if $secret -}}
{{- $secret.data.nvidiaAPIKey | b64dec -}}
{{ else -}}
{{ required ".Values.nvidia.apiKey is required!" .Values.nvidia.apiKey }}
{{- end -}}
{{- end -}}

{{/*
   Create a Client Secret for H2OGPTE API Key
*/}}
{{- define "h2oai-floodprediction.h2ogpteAPIKey" -}}
{{- $secret := (lookup "v1" "Secret" .Release.Namespace (printf "%s-secrets" .Release.Name)) -}}
{{- if .Values.h2ogpte.apiKey -}}
{{- .Values.h2ogpte.apiKey -}}
{{- else if $secret -}}
{{- $secret.data.h2ogpteAPIKey | b64dec -}}
{{ else -}}
{{ required ".Values.h2ogpte.apiKey is required!" .Values.h2ogpte.apiKey }}
{{- end -}}
{{- end -}}