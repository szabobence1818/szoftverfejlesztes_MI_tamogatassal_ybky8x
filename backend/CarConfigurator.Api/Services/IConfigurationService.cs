using CarConfigurator.Api.Dtos;

namespace CarConfigurator.Api.Services;

public interface IConfigurationService
{
    IReadOnlyList<OptionDto> GetAvailableOptions();
    ConfigurationEvaluationResultDto EvaluateConfiguration(ConfigurationRequestDto request);
    ConfigurationEvaluationResultDto ValidateSaveRequest(SaveConfigurationRequestDto request);
}
