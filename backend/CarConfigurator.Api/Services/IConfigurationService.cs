using CarConfigurator.Api.Dtos;
using CarConfigurator.Api.Models;

namespace CarConfigurator.Api.Services;

public interface IConfigurationService
{
    IReadOnlyList<OptionDto> GetAvailableOptions();
    ConfigurationEvaluationResultDto EvaluateConfiguration(ConfigurationRequestDto request);
    ConfigurationEvaluationResultDto ValidateSaveRequest(SaveConfigurationRequestDto request);

    ServiceResult<SavedConfigurationDto> SaveConfiguration(SaveConfigurationRequestDto request, string? currentUserId);
    ServiceResult<SavedConfigurationDto> GetSavedConfigurationById(int id, string? currentUserId);
    ServiceResult<IReadOnlyList<SavedConfigurationDto>> GetUserConfigurations(string? currentUserId);
    ServiceResult<SavedConfigurationDto> UpdateSavedConfiguration(int id, SaveConfigurationRequestDto request, string? currentUserId);
    ServiceResult<bool> DeleteSavedConfiguration(int id, string? currentUserId);

    void AddRule(OptionRule rule);
    void AddPackageDiscount(PackageDiscount discount);
    void UpdateOptionPrice(int optionId, decimal newPrice);
}
